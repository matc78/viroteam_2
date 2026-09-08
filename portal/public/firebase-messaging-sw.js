/* Service worker FCM — push en arrière-plan (clés publiques uniquement). */
importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyDC11KSpLJY-C07QNExa3AHuXHKk_DpXkQ",
  authDomain: "viroteam-75303.firebaseapp.com",
  projectId: "viroteam-75303",
  storageBucket: "viroteam-75303.firebasestorage.app",
  messagingSenderId: "396501317680",
  appId: "1:396501317680:web:93d4f0b325ff9c876fd5f5",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Si FCM a déjà fourni un bloc `notification`, le navigateur l'affiche :
  // ne pas rappeler showNotification (sinon double toast).
  if (payload.notification) {
    return;
  }
  const title = payload.data?.title || "ViroTeam";
  const body = payload.data?.body || "";
  const link = payload.data?.webPath || "/";
  self.registration.showNotification(title, {
    body,
    data: { url: link },
    icon: "/icon-192.png",
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
        return undefined;
      }),
  );
});
