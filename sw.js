// یک Service Worker حداقلی — فقط برای قابل‌نصب‌شدن سایت به‌عنوان اپ لازم است
const CACHE_NAME = 'tolid-markazi-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// عبور ساده‌ی درخواست‌ها — بدون کش کردن API (چون داده‌ها باید همیشه به‌روز باشند)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
