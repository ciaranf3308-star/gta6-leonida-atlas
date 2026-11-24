/* Leonida Atlas service worker — runtime caching only, no precache.
   The app shell (index.html) is network-first so a new deploy always
   lands; hashed static assets (js/css/fonts/icons) and map tiles are
   cache-first so the map still opens offline after one visit. There
   was no sw.js at all before this file — main.tsx registered one and
   every production load logged a MIME-type console error for the
   missing file. Bump CACHE_NAME when the caching rules change. */
const CACHE_NAME = 'leonida-atlas-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation (the app shell): network first, cache as fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Static assets + map tiles: cache first, populate on first fetch.
  const cacheable =
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|webmanifest|json)$/i.test(url.pathname) ||
    url.pathname.includes('/tiles/');
  if (!cacheable) return;
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
