import * as admin from "firebase-admin";
import * as crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { uniq } from "../common";
import { filterUidsByPreference, parseNotificationPreferences } from "./prefs";
import type {
  FcmPlatform,
  NotificationPreferenceKey,
  PushPayload,
} from "./types";

const TOKEN_COLLECTION = "fcmTokens";
const TOKEN_INDEX_COLLECTION = "fcmTokenIndex";
const BATCH_SIZE = 500;

type TokenRow = {
  uid: string;
  token: string;
  docPath: string;
};

/**
 * Hash court d'un token FCM pour l'id de document.
 */
export function fcmTokenDocId(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 40);
}

/**
 * Enregistre / rafraîchit un token FCM pour un uid.
 * Retire le même token des autres comptes via index `fcmTokenIndex/{hash}`.
 */
export async function upsertFcmToken(params: {
  firestore: Firestore;
  uid: string;
  token: string;
  platform: FcmPlatform;
}): Promise<void> {
  const token = params.token.trim();
  if (!token) return;
  const docId = fcmTokenDocId(token);
  const ownerRef = params.firestore
    .collection("users")
    .doc(params.uid)
    .collection(TOKEN_COLLECTION)
    .doc(docId);
  const indexRef = params.firestore.collection(TOKEN_INDEX_COLLECTION).doc(docId);

  const indexSnap = await indexRef.get();
  const previousUid = indexSnap.exists
    ? String(indexSnap.data()?.uid ?? "").trim()
    : "";
  if (previousUid && previousUid !== params.uid) {
    await params.firestore
      .collection("users")
      .doc(previousUid)
      .collection(TOKEN_COLLECTION)
      .doc(docId)
      .delete()
      .catch(() => undefined);
  }

  await ownerRef.set(
    {
      token,
      platform: params.platform,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await indexRef.set(
    {
      uid: params.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Supprime un token FCM.
 */
export async function deleteFcmToken(params: {
  firestore: Firestore;
  uid: string;
  token: string;
}): Promise<void> {
  const token = params.token.trim();
  if (!token) return;
  const docId = fcmTokenDocId(token);
  await params.firestore
    .collection("users")
    .doc(params.uid)
    .collection(TOKEN_COLLECTION)
    .doc(docId)
    .delete()
    .catch(() => undefined);

  const indexRef = params.firestore.collection(TOKEN_INDEX_COLLECTION).doc(docId);
  const indexSnap = await indexRef.get();
  if (indexSnap.exists && String(indexSnap.data()?.uid ?? "") === params.uid) {
    await indexRef.delete().catch(() => undefined);
  }
}

/**
 * Envoie une push aux uids (filtre prefs + tokens), purge les tokens invalides.
 * Retourne le nombre de tokens ciblés après filtre prefs.
 */
export async function sendPushToUids(params: {
  firestore: Firestore;
  uids: string[];
  payload: PushPayload;
}): Promise<{ recipientCount: number; tokenCount: number }> {
  const uniqueUids = uniq(params.uids.map(String).filter(Boolean));
  if (uniqueUids.length === 0) {
    return { recipientCount: 0, tokenCount: 0 };
  }

  const uidPrefs = await loadPreferences(params.firestore, uniqueUids);
  const allowedUids = filterUidsByPreference({
    uidPrefs,
    uids: uniqueUids,
    key: params.payload.preferenceKey,
  });
  if (allowedUids.length === 0) {
    return { recipientCount: 0, tokenCount: 0 };
  }

  const tokenRows = await loadTokens(params.firestore, allowedUids);
  if (tokenRows.length === 0) {
    return { recipientCount: allowedUids.length, tokenCount: 0 };
  }

  const messaging = admin.messaging();
  for (let index = 0; index < tokenRows.length; index += BATCH_SIZE) {
    const chunk = tokenRows.slice(index, index + BATCH_SIZE);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk.map((row) => row.token),
      notification: {
        title: params.payload.title,
        body: params.payload.body,
      },
      data: {
        ...params.payload.data,
        title: params.payload.title,
        body: params.payload.body,
      },
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
      webpush: {
        fcmOptions: {
          link: params.payload.data.webPath || "/",
        },
      },
    });

    const deletions: Promise<unknown>[] = [];
    response.responses.forEach((result, responseIndex) => {
      if (result.success) return;
      const code = result.error?.code ?? "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        const row = chunk[responseIndex]!;
        deletions.push(
          params.firestore.doc(row.docPath).delete().catch(() => undefined),
        );
      }
    });
    await Promise.all(deletions);
  }

  return { recipientCount: allowedUids.length, tokenCount: tokenRows.length };
}

async function loadPreferences(
  firestore: Firestore,
  uids: string[],
): Promise<Map<string, ReturnType<typeof parseNotificationPreferences>>> {
  const map = new Map<
    string,
    ReturnType<typeof parseNotificationPreferences>
  >();
  // Firestore getAll limite ~100 refs ; on chunk.
  const chunkSize = 100;
  for (let index = 0; index < uids.length; index += chunkSize) {
    const slice = uids.slice(index, index + chunkSize);
    const refs = slice.map((uid) => firestore.collection("users").doc(uid));
    const snaps = await firestore.getAll(...refs);
    snaps.forEach((snap, snapIndex) => {
      const uid = slice[snapIndex]!;
      const prefs = parseNotificationPreferences(
        snap.exists ? snap.data()?.notificationPreferences : undefined,
      );
      map.set(uid, prefs);
    });
  }
  return map;
}

async function loadTokens(
  firestore: Firestore,
  uids: string[],
): Promise<TokenRow[]> {
  const rows: TokenRow[] = [];
  await Promise.all(
    uids.map(async (uid) => {
      const snap = await firestore
        .collection("users")
        .doc(uid)
        .collection(TOKEN_COLLECTION)
        .get();
      for (const doc of snap.docs) {
        const token = String(doc.data().token ?? "").trim();
        if (!token) continue;
        rows.push({
          uid,
          token,
          docPath: doc.ref.path,
        });
      }
    }),
  );
  return rows;
}

/** Construit le data FCM commun. */
export function buildPushData(params: {
  type: string;
  clubId: string;
  deepLink: string;
  webPath: string;
  preferenceKey: NotificationPreferenceKey;
  extra?: Record<string, string>;
}): Record<string, string> {
  return {
    type: params.type,
    clubId: params.clubId,
    deepLink: params.deepLink,
    webPath: params.webPath,
    preferenceKey: params.preferenceKey,
    ...(params.extra ?? {}),
  };
}
