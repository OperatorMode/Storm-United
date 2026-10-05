// Service worker: shows push notifications (message board + team chat) and
// opens the right page when one is tapped. No offline caching on purpose —
// fixtures, attendance and chat should always be live.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "New message", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "New message", {
      body: data.body || "",
      icon: data.icon,
      badge: data.icon,
      tag: data.tag,
      renotify: true,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url === url && "focus" in w) return w.focus();
      }
      const any = wins.find((w) => "navigate" in w);
      if (any) return any.navigate(url).then((w) => w && w.focus());
      return self.clients.openWindow(url);
    }),
  );
});
