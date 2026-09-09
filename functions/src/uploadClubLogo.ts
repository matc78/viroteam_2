import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db, defineDualCallable } from "./db";
import { requireString, requireUid } from "./common";
import { assertClubAdmin } from "./guardians";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

type UploadClubLogoResponse = { logoUrl: string };

/**
 * Décode le payload image (base64 brut ou data-URL) et valide taille / type.
 */
function parseLogoPayload(data: unknown): {
  clubId: string;
  bytes: Buffer;
  contentType: string;
} {
  const payload = (data ?? {}) as Record<string, unknown>;
  const clubId = requireString(payload.clubId, "clubId");
  const rawBase64 = requireString(
    payload.imageBase64 ?? payload.logoBase64,
    "imageBase64",
  );

  let contentType = "image/jpeg";
  let base64Body = rawBase64;
  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/s.exec(rawBase64);
  if (dataUrlMatch) {
    contentType = dataUrlMatch[1].trim().toLowerCase();
    base64Body = dataUrlMatch[2];
  } else if (typeof payload.contentType === "string" && payload.contentType.trim()) {
    contentType = payload.contentType.trim().toLowerCase();
  }

  if (contentType === "image/jpg") contentType = "image/jpeg";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new HttpsError(
      "invalid-argument",
      "Type d’image non supporté (JPEG, PNG ou WebP)",
    );
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64Body, "base64");
  } catch {
    throw new HttpsError("invalid-argument", "imageBase64 invalide");
  }
  if (bytes.length === 0) {
    throw new HttpsError("invalid-argument", "Image vide");
  }
  if (bytes.length > MAX_LOGO_BYTES) {
    throw new HttpsError(
      "invalid-argument",
      "Image trop lourde (max 2 Mo)",
    );
  }

  return { clubId, bytes, contentType };
}

/**
 * Upload le logo club via Admin SDK (bypass Storage rules) puis maj `logoUrl`.
 *
 * Nécessaire car les Storage rules ne peuvent pas lire les bases Firestore
 * nommées `v2-dev` / `v2-prod` — seulement `(default)`.
 *
 * Prod → v2-prod ; `uploadClubLogoDev` → v2-dev.
 */
async function handleUploadClubLogo(
  request: CallableRequest,
): Promise<UploadClubLogoResponse> {
  const callerUid = requireUid(request);
  const { clubId, bytes, contentType } = parseLogoPayload(request.data);
  await assertClubAdmin(clubId, callerUid);

  const objectPath = `clubs/${clubId}/logo.jpg`;
  const bucket = getStorage().bucket();
  const file = bucket.file(objectPath);
  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: "public,max-age=3600",
    },
  });

  // Token de téléchargement compatible clients Firebase Storage.
  const downloadToken = cryptoRandomToken();
  await file.setMetadata({
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
    },
  });

  const encodedPath = encodeURIComponent(objectPath);
  const logoUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodedPath}?alt=media&token=${downloadToken}`;

  await db().collection("clubs").doc(clubId).update({
    logoUrl,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { logoUrl };
}

/** Génère un UUID v4 pour le token de téléchargement Storage. */
function cryptoRandomToken(): string {
  return crypto.randomUUID();
}

export const {
  prod: uploadClubLogo,
  dev: uploadClubLogoDev,
} = defineDualCallable(
  {
    // Base64 ~2,7 Mo + marge ; timeout confortable pour l’upload GCS.
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  handleUploadClubLogo,
);
