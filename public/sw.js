// Minimal service worker — required for reliable notifications on mobile.
// Chrome/Android prefers SW showNotification over page-level `new Notification`,
// and installed-PWA/iOS notifications only work through a service worker.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const conversationId = data.conversationId || data.ConversationId;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const client = clients.find((c) => "focus" in c) || clients[0];
        if (client) {
          client.focus();
          if (conversationId) {
            client.postMessage({
              type: "SELECT_CONVERSATION",
              conversationId,
            });
          }
        } else {
          self.clients.openWindow("/");
        }
      })
  );
});
