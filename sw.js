/* Service Worker для редактора персонажа */
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `character-editor-${CACHE_VERSION}`;

// Файлы для предварительного кэширования (app shell)
const PRECACHE_URLS = [
  './',
  './index.html',
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

// ============ INSTALL ============
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Предкэширование app shell');
        // Кэшируем по одному, чтобы одна ошибка не сломала всю установку
        return Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Не удалось закэшировать:', url, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ============ ACTIVATE ============
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('character-editor-') && key !== CACHE_NAME)
            .map((key) => {
              console.log('[SW] Удаляю старый кэш:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ============ FETCH ============
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Пропускаем не-GET запросы
  if (request.method !== 'GET') return;

  // Пропускаем chrome-extension, devtools и т.п.
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Стратегия для навигации (HTML) — Network First, fallback на кэш
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || caches.match('./index.html')
          )
        )
    );
    return;
  }

  // Стратегия Cache First для статики (иконки, шрифты, скрипты)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Обновляем в фоне (stale-while-revalidate)
        fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }

      // Если нет в кэше — идём в сеть и кэшируем
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch((err) => {
          console.warn('[SW] Офлайн, ресурс недоступен:', request.url);
          throw err;
        });
    })
  );
});

// ============ MESSAGES ============
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => caches.delete(key)))
      )
    );
  }
});