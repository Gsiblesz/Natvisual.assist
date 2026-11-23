// Service worker de NatVisual: muestra los avisos y abre la app al tocarlos.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(datos.title || "NatVisual", {
      body: datos.body || "",
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      tag: "natvisual-resumen",
      data: { url: datos.url || "/natvisual" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/natvisual";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if ("focus" in ventana) {
          if ("navigate" in ventana) ventana.navigate(url);
          return ventana.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
