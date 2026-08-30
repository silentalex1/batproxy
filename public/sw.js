const PROXY_HOST = self.location.origin;
const PROXY_DOMAIN = self.location.hostname;
const PROXYED_ORIGINS = new Set([
  'instagram.com', 
  'www.instagram.com', 
  'api.instagram.com',
  'facebook.com',
  'www.facebook.com',
  'static.cdninstagram.com',
  'fbcdn.net',
  'roblox.com',
  'www.roblox.com',
  'apis.roblox.com',
  'auth.roblox.com',
  'locale.roblox.com',
  'rbxcdn.com',
  'youtube.com',
  'www.youtube.com',
  'music.youtube.com',
  'octavestreaming.com',
  'music.octavestreaming.com'
]);
const CACHE_NAME = 'proxy-cache-v1';
const CACHE_DURATION = 5 * 60 * 1000;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.delete(CACHE_NAME).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/sw.js' || url.pathname === '/registerServiceWorker.ts') {
    return;
  }

  if (url.hostname.includes('facebook.com') || url.hostname.includes('instagram.com') || url.hostname.includes('fbcdn.net') || url.hostname.includes('roblox.com') || url.hostname.includes('rbxcdn.com') || url.hostname.includes('apis.roblox.com') || url.hostname.includes('auth.roblox.com') || url.hostname.includes('locale.roblox.com') || url.hostname.includes('youtube.com') || url.hostname.includes('octavestreaming.com')) {
    const proxyUrl = `${PROXY_HOST}/proxy?url=${encodeURIComponent(event.request.url)}`;
    
    let body = null;
    if (!['GET', 'HEAD'].includes(event.request.method)) {
      body = event.request.clone();
    }

    const headers = new Headers(event.request.headers);
    headers.set('X-Original-URL', event.request.url);
    headers.set('X-Original-Origin', url.origin);
    headers.set('X-Original-Host', url.hostname);

    const modifiedRequest = new Request(proxyUrl, {
      method: event.request.method,
      headers: headers,
      body: body,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
      cache: 'default'
    });

    event.respondWith(
      fetch(modifiedRequest).catch(err => {
        console.error('Proxy fetch failed:', err);
        return new Response('Proxy unreachable', { status: 503 });
      })
    );
    return;
  }

  const isProxiedAPI = url.pathname.startsWith('/ajax/') || 
                       url.pathname.startsWith('/api/') ||
                       url.pathname.startsWith('/graphql') ||
                       url.pathname.includes('/ig_xsite_user_info');
  
  if (isProxiedAPI) {
    let originalUrl;
    if (url.pathname.includes('/ig_xsite_user_info')) {
      originalUrl = `https://www.facebook.com${url.pathname}${url.search}`;
    } else {
      originalUrl = `https://www.instagram.com${url.pathname}${url.search}`;
    }
    
    const proxyUrl = `${PROXY_HOST}/proxy?url=${encodeURIComponent(originalUrl)}`;
    
    let body = null;
    if (!['GET', 'HEAD'].includes(event.request.method)) {
      body = event.request.clone();
    }

    const headers = new Headers(event.request.headers);
    headers.set('X-Original-URL', originalUrl);
    headers.set('X-Original-Origin', originalUrl.includes('facebook.com') ? 'https://www.facebook.com' : 'https://www.instagram.com');
    headers.set('X-Original-Host', originalUrl.includes('facebook.com') ? 'www.facebook.com' : 'www.instagram.com');

    const modifiedRequest = new Request(proxyUrl, {
      method: event.request.method,
      headers: headers,
      body: body,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
      cache: 'default'
    });

    event.respondWith(
      fetch(modifiedRequest).catch(err => {
        console.error('Proxy fetch failed:', err);
        return new Response('Proxy unreachable', { status: 503 });
      })
    );
    return;
  }

  if (url.hostname.includes('facebook.com') || url.hostname.includes('instagram.com') || url.hostname.includes('fbcdn.net')) {
    const proxyUrl = `${PROXY_HOST}/proxy?url=${encodeURIComponent(event.request.url)}`;
    
    let body = null;
    if (!['GET', 'HEAD'].includes(event.request.method)) {
      body = event.request.clone();
    }

    const headers = new Headers(event.request.headers);
    headers.set('X-Original-URL', event.request.url);
    headers.set('X-Original-Origin', url.origin);
    headers.set('X-Original-Host', url.hostname);

    const modifiedRequest = new Request(proxyUrl, {
      method: event.request.method,
      headers: headers,
      body: body,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
      cache: 'default'
    });

    event.respondWith(
      fetch(modifiedRequest).catch(err => {
        console.error('Proxy fetch failed:', err);
        return new Response('Proxy unreachable', { status: 503 });
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    return;
  }

  if (url.hostname === PROXY_DOMAIN) {
    return;
  }

  const shouldProxy = PROXYED_ORIGINS.has(url.hostname) || 
                     url.hostname.includes('instagram') ||
                     url.hostname.includes('facebook') ||
                     url.hostname.includes('fbcdn');

  if (!shouldProxy) {
    return;
  }

  const proxyUrl = `${PROXY_HOST}/proxy?url=${encodeURIComponent(event.request.url)}`;

  let body = null;
  if (!['GET', 'HEAD'].includes(event.request.method)) {
    body = event.request.clone();
  }

  const headers = new Headers(event.request.headers);
  headers.set('X-Original-URL', event.request.url);
  headers.set('X-Original-Origin', url.origin);
  headers.set('X-Original-Host', url.hostname);

  const modifiedRequest = new Request(proxyUrl, {
    method: event.request.method,
    headers: headers,
    body: body,
    mode: 'cors',
    credentials: 'include',
    redirect: 'follow',
    cache: 'default'
  });

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        if (cachedResponse && event.request.method === 'GET') {
          const cachedDate = new Date(cachedResponse.headers.get('date'));
          if (Date.now() - cachedDate.getTime() < CACHE_DURATION) {
            return cachedResponse;
          }
        }

        return fetch(modifiedRequest).then((response) => {
          const newHeaders = new Headers();
          
          for (const [key, value] of response.headers.entries()) {
            if (!key.toLowerCase().startsWith('x-') && key.toLowerCase() !== 'set-cookie' && key.toLowerCase() !== 'x-frame-options' && key.toLowerCase() !== 'content-security-policy') {
              newHeaders.set(key, value);
            }
          }

          newHeaders.set('X-Proxy-Response', 'true');
          newHeaders.set('Access-Control-Allow-Origin', '*');
          newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          newHeaders.set('Access-Control-Allow-Headers', '*');
          newHeaders.set('Access-Control-Allow-Credentials', 'true');
          newHeaders.set('X-Proxy-Cache-Date', new Date().toUTCString());

          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html') && event.request.method === 'GET') {
            return response.text().then((text) => {
              const rewrittenText = text
                .replace(/https:\/\/www\.instagram\.com/g, PROXY_HOST)
                .replace(/https:\/\/instagram\.com/g, PROXY_HOST)
                .replace(/https:\/\/www\.facebook\.com/g, PROXY_HOST)
                .replace(/https:\/\/facebook\.com/g, PROXY_HOST)
                .replace(/https:\/\/static\.cdninstagram\.com/g, PROXY_HOST)
                .replace(/https:\/\/.*\.fbcdn\.net/g, PROXY_HOST)
                .replace(/https:\/\/www\.roblox\.com/g, PROXY_HOST)
                .replace(/https:\/\/roblox\.com/g, PROXY_HOST)
                .replace(/https:\/\/apis\.roblox\.com/g, PROXY_HOST)
                .replace(/https:\/\/auth\.roblox\.com/g, PROXY_HOST)
                .replace(/https:\/\/locale\.roblox\.com/g, PROXY_HOST)
                .replace(/https:\/\/.*\.rbxcdn\.com/g, PROXY_HOST)
                .replace(/https:\/\/www\.youtube\.com/g, PROXY_HOST)
                .replace(/https:\/\/youtube\.com/g, PROXY_HOST)
                .replace(/https:\/\/music\.youtube\.com/g, PROXY_HOST)
                .replace(/https:\/\/octavestreaming\.com/g, PROXY_HOST)
                .replace(/https:\/\/music\.octavestreaming\.com/g, PROXY_HOST);

              const modifiedResponse = new Response(rewrittenText, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
              });

              if (response.ok) {
                cache.put(event.request, modifiedResponse.clone());
              }

              return modifiedResponse;
            });
          }

          const modifiedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
          });

          if (event.request.method === 'GET' && response.ok) {
            cache.put(event.request, modifiedResponse.clone());
          }

          return modifiedResponse;
        }).catch((error) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response('Proxy error: ' + error.message, {
            status: 500,
            headers: { 
              'Content-Type': 'text/plain',
              'Access-Control-Allow-Origin': '*'
            }
          });
        });
      });
    })
  );
});
