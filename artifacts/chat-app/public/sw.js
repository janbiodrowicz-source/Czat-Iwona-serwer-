self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "Chat Iwona", body: event.data.text() }; }
  const title = data.title || "Chat Iwona";
  const options = {
    body: data.body || "Masz nową wiadomość",
    icon: data.icon || "/favicon.ico",
    badge: "/favicon.ico",
    data: data.data || {},
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
