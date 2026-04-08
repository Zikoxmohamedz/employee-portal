// sw.js - Service Worker for Push Notifications
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: 'تنبيه جديد', body: 'لديك رسالة جديدة من الإدارة' };
  
  const options = {
    body: data.body,
    icon: 'https://ui-avatars.com/api/?name=EP&background=2563eb&color=fff&size=192',
    badge: 'https://ui-avatars.com/api/?name=EP&background=2563eb&color=fff&size=96',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/index.html'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
