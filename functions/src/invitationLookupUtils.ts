import { HttpsError } from "firebase-functions/v2/https";

/**
 * Fonctions pures de `lookupInvitationByCode` (testées sans émulateur).
 */

const CODE_MIN_LENGTH = 4;
const CODE_MAX_LENGTH = 32;

/** Valide `{ code }` : trim + upper, longueur bornée, sinon `invalid-argument`. */
export function parseLookupCodeArgs(data: unknown): { code: string } {
  const payload = (data ?? {}) as Record<string, unknown>;
  const raw = typeof payload.code === "string" ? payload.code : "";
  const code = raw.trim().toUpperCase();
  if (code.length < CODE_MIN_LENGTH || code.length > CODE_MAX_LENGTH) {
    throw new HttpsError("invalid-argument", "code requis");
  }
  if (!/^[A-Z0-9-]+$/.test(code)) {
    throw new HttpsError("invalid-argument", "code invalide");
  }
  return { code };
}

/**
 * Masque un e-mail pour affichage : `m•••@gmail.com`.
 * Seul le premier caractère de la partie locale est conservé ; le domaine
 * reste lisible pour que l'invité reconnaisse son adresse.
 * Retourne `null` si l'e-mail est absent ou inexploitable.
 */
export function maskEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  return `${local.charAt(0)}•••@${domain}`;
}

/** Convertit un Timestamp/Date Firestore en ISO 8601 (ou null). */
export function toIsoOrNull(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate === "function") {
    return maybe.toDate().toISOString();
  }
  return null;
}

/** Vrai si `expiresAt` (Timestamp/Date) est dépassé. */
export function isExpired(value: unknown, nowMs: number = Date.now()): boolean {
  const iso = toIsoOrNull(value);
  if (!iso) return false;
  return new Date(iso).getTime() < nowMs;
}
