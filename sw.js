// DQAP Wiki Service Worker
// Version 75 — mandatory task actions, CRM 20260622.8, Debt 20260622.2
const CACHE_VERSION = 'dqap-v75-crm-20260622-8-debt-20260622-2';
const CACHE_NAME = CACHE_VERSION;

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHtml = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  if (isHtml) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone());
        return fresh;
      } catch (error) {
        return (await caches.match(request)) || caches.match('./index.html');
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const fresh = await fetch(request, { cache: 'no-store' });
      if (fresh && fresh.status === 200) cache.put(request, fresh.clone());
      return fresh;
    } catch (error) {
      return cache.match(request);
    }
  })());
});
