declare global {
  interface Window {
    BareMux: {
      BareMuxConnection: new (worker: string) => {
        getTransport: () => Promise<string>;
        setTransport: (path: string, args: unknown[]) => Promise<void>;
      };
    };
    __uv$config: {
      prefix: string;
      encodeUrl: (url: string) => string;
      decodeUrl: (url: string) => string;
    };
  }
}

let uvReady: Promise<void> | null = null;

function waitForWorker(worker: ServiceWorker | null): Promise<void> {
  if (!worker || worker.state === 'activated') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' || worker.state === 'redundant') done();
    });
  });
}

function normalizeTarget(targetUrl: string): string {
  const cleaned = targetUrl.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!cleaned) return cleaned;
  try {
    const u = new URL(cleaned.includes('://') ? cleaned : 'https://' + cleaned);
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.toString();
  } catch {
    return cleaned;
  }
}

export function getUvUrl(targetUrl: string): string {
  const ready = normalizeTarget(targetUrl);
  return window.__uv$config.prefix + window.__uv$config.encodeUrl(ready);
}

export function getSandboxUrl(targetUrl: string): string {
  return '/proxy?url=' + encodeURIComponent(normalizeTarget(targetUrl));
}

export function decodeProxiedLocation(href: string): string | null {
  try {
    const parsed = new URL(href, window.location.origin);
    if (parsed.pathname === '/proxy') {
      return parsed.searchParams.get('url');
    }
    const prefix = window.__uv$config?.prefix;
    if (prefix && parsed.pathname.startsWith(prefix) && window.__uv$config.decodeUrl) {
      return window.__uv$config.decodeUrl(parsed.pathname.slice(prefix.length) + parsed.search);
    }
  } catch {
    return null;
  }
  return null;
}

export function initUltraviolet(): Promise<void> {
  if (!uvReady) {
    uvReady = (async () => {
      if (!window.__uv$config || !window.BareMux) {
        throw new Error('Ultraviolet scripts failed to load');
      }
      if (typeof SharedWorker === 'undefined') {
        throw new Error('SharedWorker unavailable');
      }
      const wispUrl =
        (location.protocol === 'https:' ? 'wss' : 'ws') +
        '://' +
        location.host +
        '/wisp/';
      const connection = new window.BareMux.BareMuxConnection('/baremux/worker.js');
      const transport = connection.setTransport('/epoxy/index.mjs', [{ wisp: wispUrl }]);
      const reg = await navigator.serviceWorker.register('/uv/sw.js', { scope: '/uv/' });
      await waitForWorker(reg.active || reg.installing || reg.waiting);
      if (!reg.active) {
        await waitForWorker(reg.installing || reg.waiting);
      }
      await transport;
    })().catch((err) => {
      uvReady = null;
      throw err;
    });
  }
  return uvReady;
}
