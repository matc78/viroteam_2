import { getMessaging, getToken, isSupported, deleteToken } from "firebase/messaging";
import { getFirebaseApp } from "./app";
import {
  registerFcmToken,
  unregisterFcmToken,
} from "./callableService";

let lastToken: string | null = null;

/** État du push web pour ce navigateur. */
export type WebPushAvailability =
  | "unconfigured"
  | "unsupported"
  | NotificationPermission;

function vapidKeyOrNull(): string | null {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() || null;
}

/**
 * Disponibilité du push web : clé VAPID absente, navigateur non compatible,
 * ou permission courante (`default` = jamais demandée).
 */
export async function webPushAvailability(): Promise<WebPushAvailability> {
  if (typeof window === "undefined") return "unsupported";
  if (!vapidKeyOrNull()) return "unconfigured";
  const supported = await isSupported().catch(() => false);
  if (!supported || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

/**
 * Démarre FCM Web et enregistre le token (si VAPID configuré).
 * Sans `requestPermission`, ne s’abonne que si la permission est déjà
 * accordée : la demande navigateur exige un geste utilisateur
 * (`enableWebPush`, bouton des réglages).
 */
export async function startWebPush(options?: {
  requestPermission?: boolean;
}): Promise<NotificationPermission | null> {
  if (typeof window === "undefined") return null;
  const vapidKey = vapidKeyOrNull();
  if (!vapidKey) {
    console.info(
      "Push web désactivé : définir NEXT_PUBLIC_FIREBASE_VAPID_KEY (Firebase Console → Cloud Messaging → certificats Web Push).",
    );
    return null;
  }

  const supported = await isSupported().catch(() => false);
  if (!supported || typeof Notification === "undefined") return null;

  const permission =
    Notification.permission === "default" && options?.requestPermission
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return permission;

  await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(getFirebaseApp());
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token || token === lastToken) return permission;

  await registerFcmToken({ token, platform: "web" });
  lastToken = token;
  return permission;
}

/**
 * Active le push web suite à un geste utilisateur (clic) : demande la
 * permission si besoin puis enregistre le token. Retourne la permission.
 */
export async function enableWebPush(): Promise<NotificationPermission | null> {
  return startWebPush({ requestPermission: true });
}

/** Désenregistre le token web courant (logout). */
export async function stopWebPush(): Promise<void> {
  if (typeof window === "undefined") return;
  // Push jamais démarré sans VAPID : rien à désenregistrer.
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim()) return;
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
