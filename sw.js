// ===================================================================
// Service Worker با پشتیبانی واقعی از حالت آفلاین
// صفحات و فایل‌های اصلی کش می‌شوند؛ درخواست‌های API هرگز کش نمی‌شوند
// (چون داده‌ها باید همیشه تازه باشند)
// ===================================================================
const CACHE_NAME = 'hamtasanat-shell-v2';
const APP_SHELL = [
  './',
  './index.html',
  './company.html',
  './admin.html',
  './company-profile.html',
  './manifest.json',
  './assets/styles.css?v=2',
  './assets/config.js',
  './assets/theme.js?v=2',
  './assets/app.js?v=2',
  './assets/company.js?v=2',
  './assets/admin.js?v=2',
  './assets/company-profile.js?v=2',
  './assets/support-widget.js?v=2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.hostname.includes('workers.dev') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'اتصال اینترنت برقرار نیست. وقتی دوباره وصل شدید امتحان کنید.' }), {
          headers: { 'Content-Type': 'application/json' }, status: 503,
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// نمایش اعلان فوری وقتی پیام Push از سرور می‌رسد (حتی اگر سایت بسته باشد)
self.addEventListener('push', (event) => {
  let data = { title: 'همتا صنعت مرکزی', body: 'اعلان جدید', link: '/' };
  try { data = { ...data, ...event.data.json() }; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/icon-192.png',
      dir: 'rtl',
      data: { link: data.link || '/' },
    })
  );
});

// کلیک روی اعلان: باز کردن یا فوکوس‌کردن پنل
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('company.html') && 'focus' in client) {
          client.navigate('./company.html' + (link.startsWith('#') ? link : ''));
          return client.focus();
        }
      }
      return clients.openWindow('./company.html' + (link.startsWith('#') ? link : ''));
    })
  );
});
