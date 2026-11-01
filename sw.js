/* QuizBuilt PWA service worker. Scoped to the app folder so root and subfolder deployments work. */
const VERSION = 'qb-pwa-v5';
const APP_ROOT = new URL('./', self.registration.scope);
const APP_HOME = APP_ROOT.href;
const SHELL = [
  APP_HOME,
  new URL('manifest.webmanifest', APP_ROOT).href,
  new URL('icon-192.png', APP_ROOT).href,
  new URL('icon-512.png', APP_ROOT).href,
  new URL('maskable-512.png', APP_ROOT).href
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(APP_HOME, copy));
        }
        return response;
      }).catch(async () => {
        const cache = await caches.open(VERSION);
        return (await cache.match(APP_HOME)) || Response.error();
      })
    );
    return;
  }

  if (url.origin === self.location.origin || CDN_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
        return response;
      }).catch(() => cached || Response.error());
      return cached || network;
    })());
  }
});
