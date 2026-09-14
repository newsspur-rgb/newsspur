self.addEventListener('push', (event) => {
  let daten = { titel: 'NEWSSPUR', text: 'Neue Meldung verfügbar.', url: 'https://newsspur.de' };
  try {
    if (event.data) daten = { ...daten, ...event.data.json() };
  } catch (e) {
    console.error('Push-Payload konnte nicht gelesen werden:', e);
  }

  event.waitUntil(
    self.registration.showNotification(daten.titel, {
      body: daten.text,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: daten.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ziel = event.notification.data && event.notification.data.url ? event.notification.data.url : 'https://newsspur.de';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fensterListe) => {
      for (const fenster of fensterListe) {
        if (fenster.url === ziel && 'focus' in fenster) return fenster.focus();
      }
      if (clients.openWindow) return clients.openWindow(ziel);
    }),
  );
});
