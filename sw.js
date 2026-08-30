/* Cache-first app-shell service worker.
 * Bump CACHE_NAME on every deploy so users get updates. */
const CACHE_NAME = 'cigtrack-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './jalali.js',
  './db.js',
  './app.js',
  './icon-192.png',
  './icon-512.png',
  './icon-180-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
    )).then(() => self.clients.claim()),
  );
});

// Cache-first, falling back to network, falling back to cached index.html
// for navigations (so the app still opens with no connection at all).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    }),
  );
});
