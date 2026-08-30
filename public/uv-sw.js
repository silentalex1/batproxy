import { UVServiceWorker, UVConfig } from '@titaniumnetwork-dev/ultraviolet';

const config = new UVConfig({
  prefix: '/uv/service/',
  encodeUrl: (url) => {
    return encodeURIComponent(url);
  },
  decodeUrl: (url) => {
    return decodeURIComponent(url);
  },
  handler: '/uv/handler',
  client: '/uv/client',
  bare: '/uv/bare',
  forward_headers: ['accept-language', 'accept-encoding'],
  block_request: (req) => {
    return false;
  }
});

const sw = new UVServiceWorker(config);

self.addEventListener('fetch', (event) => sw.fetch(event));
