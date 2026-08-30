// DQAP Wiki Service Worker
// Version 78.45 - New PMO (Beta) expanded schedule/Gantt redesigned to fit
// a single screen with no horizontal scrolling: the per-day calendar grid
// is replaced with a compact percentage-scaled Gantt bar per stage (Task,
// Assigned to, Start, End, Status, Progress checkbox stay, all narrower/
// tighter font); month ticks and the "today" marker are now positioned by
// percentage instead of per-day columns. The Excel export keeps the full
// day-grid format unchanged.
// Version 78.44 - New PMO (Beta) reworked to match the existing PMO Details
// page exactly: collapsed project rows now use the same table/columns
// (Project ID, Project, Status, Overall, LD Date, Target, Budget, GM,
// Spent) and the same expand/collapse click behavior. Expanding a project
// now shows the Gantt + schedule table (Task/Assigned to/Start/End/Status/
// Progress checkbox) in place of the removed %age Stage Details block,
// followed by the same Project Documents section PMO already uses (shared
// off the underlying project record, not duplicated).
// Version 78.43 - Added "New PMO (Beta)" module: a date-driven project
// schedule with a compact Gantt view (Task / Assigned to / Start / End /
// Progress / Status), running alongside the existing PMO module untouched
// (separate sidebar item, separate view, separate Firestore collection
// dqap_pmo_beta — PMO itself and dqap_pmo are not read from or written to
// except by the one-way "Import from PMO" / "Re-check from PMO" actions).
// Also: PMO layout made responsive for narrower PC/mobile screens, and
// Manage Projects now lets Updesh edit a project's name (previously
// locked), propagating the rename to linked Budget Configuration and PMO
// records.
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
const CACHE_VERSION = 'dqap-wiki-v78.45-20260830-3';
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
