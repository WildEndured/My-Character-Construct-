const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = `character-editor-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './storage.js',
  './renderer.js',
  './history.js',
  './exporter.js',
  './gallery.js',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map(u => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('character-editor-') && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
          return r;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        fetch(request).then(r => {
          if (r && r.status === 200 && r.type === 'basic') {
            caches.open(CACHE_NAME).then(c => c.put(request, r.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then(r => {
        if (!r || r.status !== 200 || r.type !== 'basic') return r;
        const copy = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, copy));
        return r;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});