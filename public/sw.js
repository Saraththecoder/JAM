// Service Worker for JAM Campus Letter Web Push Notifications

self.addEventListener('push', function (event) {
  if (!event.data) return;

  let payload = {
    title: 'JAM Notification',
    body: 'You have a new update on your campus letter request.',
    url: '/',
    icon: '/favicon.ico',
  };

  try {
    payload = event.data.json();
  } catch (e) {
    payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      url: payload.url || '/',
    },
    tag: payload.tag || 'jam-push-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'JAM Notification', options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = event.notification.data && event.notification.data.url 
    ? event.notification.data.url 
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
