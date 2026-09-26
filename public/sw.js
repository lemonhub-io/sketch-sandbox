/* sw.js — offline service worker for Sketch Sandbox.
   The world is procedural: once the app shell + WASM are cached, the game
   runs fully offline. Strategy:
     - install: precache the fixed app shell below
     - navigations: network-first (fresh deploys land immediately), cached
       index.html as offline fallback
     - same-origin assets (hashed vite bundle, wasm, worker, icons):
       cache-first, populating the cache on first fetch
   Bump VERSION on each deploy so stale caches are purged. */

const VERSION = 'v1';
const CACHE = 'sketch-sandbox-' + VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './worldcore.js',
  './worker.js',
  './wasm/wc.js',
  './wasm/wc_bg.wasm',
  './vendor/workerpool.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
      // precache the hashed build assets too (assets/index-*.js/css) by
      // scraping the shell we just cached — no build-time file list needed
      const res = await caches.match('./index.html');
      const html = await res.text();
      const extra = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((u) => u.startsWith('./') || (!u.includes(':') && !u.startsWith('#')));
      await cache.addAll([...new Set(extra)]);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
