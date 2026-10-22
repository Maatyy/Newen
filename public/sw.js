// Service worker: recibe los avisos push y deja la app disponible sin conexión.
const CACHE = 'gym-hombre-v2';
const CORE = ['/', '/index.html', '/app.js', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero la red (para tener siempre la última versión); si no hay conexión, la copia guardada
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('/') : Response.error()))));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  const title = String(d.title || 'Mi Guía Gym').slice(0, 80);
  const body = String(d.body || '').slice(0, 300);
  const url = typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/';
  e.waitUntil(self.registration.showNotification(title, {
    body, icon: '/icons/icon-192.png', badge: '/icons/icon-96.png', tag: d.tag || 'gym', renotify: true, data: { url },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (new URL(c.url).origin === location.origin) { c.focus(); return c.navigate ? c.navigate(url).catch(() => {}) : null; }
    return self.clients.openWindow(url);
  }));
});
