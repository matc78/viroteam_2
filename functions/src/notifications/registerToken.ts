import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db, defineDualCallable } from "../db";
import { requireString, requireUid } from "../common";
import { deleteFcmToken, upsertFcmToken } from "./send";
import type { FcmPlatform } from "./types";

const PLATFORMS = new Set<FcmPlatform>(["ios", "android", "web"]);

function requirePlatform(value: unknown): FcmPlatform {
  const platform = requireString(value, "platform") as FcmPlatform;
  if (!PLATFORMS.has(platform)) {
    throw new HttpsError("invalid-argument", "platform invalide");
  }
  return platform;
}

/**
 * Enregistre le token FCM de l'utilisateur authentifié.
 */
export const {
  prod: registerFcmToken,
  dev: registerFcmTokenDev,
} = defineDualCallable(async (request: CallableRequest) => {
  const uid = requireUid(request);
  const token = requireString(request.data?.token, "token");
  const platform = requirePlatform(request.data?.platform);
  await upsertFcmToken({
    firestore: db(),
    uid,
    token,
    platform,
  });
  return { ok: true };
});

/**
 * Supprime un token FCM (logout / révocation).
 */
export const {
  prod: unregisterFcmToken,
  dev: unregisterFcmTokenDev,
} = defineDualCallable(async (request: CallableRequest) => {
  const uid = requireUid(request);
  const token = requireString(request.data?.token, "token");
  await deleteFcmToken({ firestore: db(), uid, token });
  return { ok: true };
});
