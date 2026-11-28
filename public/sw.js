/*
 * LifeOS service worker: lets the app open offline and install as an app.
 *
 * Your data never goes through here (it lives in the browser's IndexedDB); this only caches the
 * app's own files. Pages are network-first, so a new version shows up as soon as it's deployed;
 * the cache is only the fallback when you're offline. Hashed build files (assets/…) never change,
 * so they're served from the cache once fetched. Other sites (sync, AI, Scholar) are never touched.
 */
const CACHE = 'lifeos-v1';
const MAX_ASSETS = 80;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './favicon.svg']).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = (await cache.keys()).filter((r) => r.url.includes('/assets/'));
  for (const r of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(r);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // sync, AI providers, Scholar: straight to the network

  // build files: immutable, cache-first
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone()).then(() => trim(c));
        return res;
      }),
    );
    return;
  }

  // pages and everything else (incl. data/scholar.json): network first, cache as the offline fallback
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || url.pathname.endsWith('.json') || url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? './' : req, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(req.mode === 'navigate' ? './' : req)) ?? (await caches.match('./')) ?? Response.error()),
  );
});
