/* PKG87_FIX36｜GitHub Pages PWA Service Worker
   單檔 index 版：CSS / JS 已內嵌到 index.html，避免 GitHub Pages 少傳 assets 時變成純文字。
*/
const CACHE_NAME = 'pigfarm-map-87fix36';
const APP_SHELL = [
  './',
  './index.html?v=87fix36',
  './manifest.webmanifest?v=87fix36',
  './offline.html',
  './data/pig_farm_map_data.json?v=87fix36',
  './assets/icons/icon-192.png?v=87fix36',
  './assets/icons/icon-512.png?v=87fix36',
  './assets/icons/apple-touch-icon.png?v=87fix36',
  './assets/icons/maskable-512.png?v=87fix36'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('pigfarm-map-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!isSameOrigin(url)) return;

  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(cached =>
          cached || caches.match('./index.html?v=87fix36').then(html => html || caches.match('./offline.html'))
        ))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
