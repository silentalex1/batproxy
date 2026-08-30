export const SEARCH_ENGINES = [
  'BatNight Engine',
  'Scremjet',
  'Google',
  'Bing',
  'DuckDuckGo',
  'Yahoo',
  'Ask'
] as const;

export type SearchEngineName = (typeof SEARCH_ENGINES)[number];

export const MOVIES_URL = 'https://triplethd.noordware.com';

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const IP_HOST = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#].*)?$/i;
const DOMAIN_HOST = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(?::\d+)?(?:[/?#].*)?$/i;

export function sanitizeQuery(raw: string): string {
  return raw.replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();
}

export function isWebUrl(raw: string): boolean {
  const s = sanitizeQuery(raw);
  if (!s || /\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      return !!u.hostname;
    } catch {
      return false;
    }
  }
  if (/^\/\//.test(s)) return true;
  return DOMAIN_HOST.test(s) || IP_HOST.test(s) || LOCAL_HOST.test(s);
}

export function canonicalizeUrl(raw: string): string {
  const s = sanitizeQuery(raw);
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol === 'http:') u.protocol = 'https:';
      return u.toString();
    } catch {
      return s.startsWith('http://') ? 'https://' + s.slice(7) : s;
    }
  }
  if (s.startsWith('//')) return 'https:' + s;
  return 'https://' + s;
}

export function getSelectedEngine(): SearchEngineName {
  try {
    const engine = JSON.parse(localStorage.getItem('batprox-settings') || '{}').browserType;
    if (SEARCH_ENGINES.includes(engine as SearchEngineName)) return engine as SearchEngineName;
  } catch {
  }
  return 'BatNight Engine';
}

function batNightTarget(query: string): string {
  const q = sanitizeQuery(query);
  if (!q) return 'https://duckduckgo.com/';
  if (isWebUrl(q)) return canonicalizeUrl(q);
  const bang = q.match(/^!([a-z0-9]+)(?:\s+|$)(.*)$/i);
  if (bang) {
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(q) + '&ia=web';
  }
  return (
    'https://duckduckgo.com/?q=' +
    encodeURIComponent(q) +
    '&ia=web&kp=-1&k1=-1&kad=en_US&kae=d'
  );
}

function scremjetTarget(query: string): string {
  const q = sanitizeQuery(query);
  if (!q) return 'https://search.brave.com/';
  if (isWebUrl(q)) return canonicalizeUrl(q);
  return 'https://search.brave.com/search?q=' + encodeURIComponent(q) + '&source=web';
}

const ENGINE_PREFIX: Record<SearchEngineName, string> = {
  'BatNight Engine': '',
  Scremjet: '',
  Google: 'https://www.google.com/search?q=',
  Bing: 'https://www.bing.com/search?q=',
  DuckDuckGo: 'https://duckduckgo.com/?q=',
  Yahoo: 'https://search.yahoo.com/search?p=',
  Ask: 'https://www.ask.com/web?q='
};

export function buildSearchUrl(query: string, engineName?: string): string {
  const q = sanitizeQuery(query);
  if (!q) return '';
  if (isWebUrl(q)) return canonicalizeUrl(q);
  const engine = (engineName as SearchEngineName) || getSelectedEngine();
  if (engine === 'BatNight Engine') return batNightTarget(q);
  if (engine === 'Scremjet') return scremjetTarget(q);
  const prefix = ENGINE_PREFIX[engine] || ENGINE_PREFIX['BatNight Engine'];
  if (!prefix) return batNightTarget(q);
  return prefix + encodeURIComponent(q);
}

export function moviesSearchUrl(): string {
  return MOVIES_URL;
}
