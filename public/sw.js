const STATIC_CACHE = 'fix-my-area-static-v1';
const PAGE_CACHE = 'fix-my-area-pages-v1';
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.webmanifest',
  '/apple-icon.png',
  '/icon.svg',
  '/icon-light-32x32.png',
  '/icon-dark-32x32.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, PAGE_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(url));
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.webmanifest' ||
    /\.(?:css|gif|ico|jpeg|jpg|js|png|svg|webp)$/.test(url.pathname)
  ) {
    event.respondWith(handleStaticRequest(request));
  }
});

async function handleNavigationRequest(url) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(url.href);

    if (response.ok) {
      await cache.put(url.pathname, response.clone());
    }

    return response;
  } catch {
    return (
      (await cache.match(url.pathname)) ||
      (await cache.match('/')) ||
      (await caches.match('/offline'))
    );
  }
}

async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  const networkResponse = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkResponse;
}
