const CACHE = "koliya-v1";
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./index.html","./manifest.json"])));
  self.skipWaiting();
});
self.addEventListener("activate", e => self.clients.claim());
self.addEventListener("fetch", e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
// Web Push (production): show native notification even if tab closed
self.addEventListener("push", e => {
  const data = e.data ? e.data.json() : { title: "Koliya", body: "You have a new notification" };
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%234F46E5'/%3E%3Ctext x='50' y='68' font-size='58' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'%3EK%3C/text%3E%3C/svg%3E"
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow("./index.html"));
});