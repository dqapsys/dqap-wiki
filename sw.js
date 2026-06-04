// DQAP Wiki Service Worker
// Bump CACHE_VERSION on every deploy to invalidate old caches.
const CACHE_VERSION = 'dqap-v58';
const CACHE_NAME = CACHE_VERSION;

// Install: activate immediately, don't wait for old tabs to close.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: delete any cache that isn't the current version, then take control.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Allow the page to trigger immediate activation of a waiting worker.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch strategy:
//  - HTML / navigation requests  -> NETWORK FIRST (always get the freshest page;
//    fall back to cache only when offline). This is what prevents stale versions.
//  - Everything else (assets)    -> STALE-WHILE-REVALIDATE (fast, but self-updating).
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET; let the browser deal with the rest.
  if (req.method !== 'GET') return;

  // Never cache cross-origin calls (Firebase, CDNs, APIs) — pass straight through.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // NETWORK FIRST for pages
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match(req);
          return cached || caches.match('./index.html');
        }
      })()
    );
    return;
  }

  // STALE-WHILE-REVALIDATE for static assets
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
});

