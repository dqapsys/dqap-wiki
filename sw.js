// DQAP Wiki Service Worker
// Version 78.40 - Sales CRM -> PMO Kickoff automation: deal reaching "Order"
// stage now fires a Critical task for Keshav (Manage Projects + New PMO
// Project), with a 24h SLA auto-escalation to Pratim/Updesh, and carries the
// sales PO (uploaded to Drive from the CRM's Edit Deal modal) through to that
// task so it can be re-filed into the project's own "PMO" Drive folder.
// Version 78.32 - CSS module launcher and authenticated handoff.
// Version 78.27 - Restored the "Leaderboard" sidebar link/page (kept, per
// request, only the old individual scoring was meant to be removed). Now
// shows a department-based team scorecard: Sales/Tech/PMO/F&A scored on
// Sales-New, Billing & Collection, Attendance, Project Completion, HSM.
// Attendance is computed live from Wiki data by department; the other four
// are manual per-period inputs (admin/Pratim) pending module integration.
const CACHE_PREFIX = 'dqap-wiki-';
const CACHE_VERSION = 'dqap-wiki-v78.40-20260718-1';
const CACHE_NAME = CACHE_VERSION;
const APP_SHELL = ['./', './index.html'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Do not fail installation if one optional GitHub Pages route is unavailable.
    await Promise.allSettled(APP_SHELL.map(async asset => {
      const response = await fetch(asset, { cache: 'reload' });
      if (response.ok) await cache.put(asset, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // CacheStorage is shared by every repository on dqapsys.github.io. Remove
    // only older Wiki caches; never delete CRM or Debt Management caches.
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  // Never cache partial-content responses used for media/file downloads.
  if (request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scopePath = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return;
  const isHtml = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  if (isHtml) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh.ok) {
          await cache.put(request, fresh.clone());
        }
        return fresh;
      } catch (error) {
        // Search only this Wiki release cache, not caches owned by CRM/Debt.
        return (await cache.match(request)) ||
          (await cache.match('./')) ||
          (await cache.match('./index.html')) ||
          new Response('DQAP Wiki is offline. Reconnect and try again.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const fresh = await fetch(request, { cache: 'no-store' });
      if (fresh && fresh.ok) await cache.put(request, fresh.clone());
      return fresh;
    } catch (error) {
      return (await cache.match(request)) || Response.error();
    }
  })());
});
