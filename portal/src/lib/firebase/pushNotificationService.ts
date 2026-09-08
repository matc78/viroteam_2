import { getMessaging, getToken, isSupported, deleteToken } from "firebase/messaging";
import { getFirebaseApp } from "./app";
import {
  registerFcmToken,
  unregisterFcmToken,
} from "./callableService";

let lastToken: string | null = null;

/**
 * Démarre FCM Web : permission + enregistrement token (si VAPID configuré).
 */
export async function startWebPush(): Promise<void> {
  if (typeof window === "undefined") return;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) {
    console.info(
      "Push web désactivé : définir NEXT_PUBLIC_FIREBASE_VAPID_KEY (Firebase Console → Cloud Messaging → certificats Web Push).",
    );
    return;
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(getFirebaseApp());
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token || token === lastToken) return;

  await registerFcmToken({ token, platform: "web" });
  lastToken = token;
}

/** Désenregistre le token web courant (logout). */
export async function stopWebPush(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) return;
    const messaging = getMessaging(getFirebaseApp());
    const token = lastToken;
    if (token) {
      await unregisterFcmToken({ token });
      lastToken = null;
    }
    await deleteToken(messaging).catch(() => undefined);
  } catch {
    // best-effort
  }
}
