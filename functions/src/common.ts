import { HttpsError } from "firebase-functions/v2/https";

/**
 * Helpers purs partagés par les callables du lot 1 (aucune dépendance à
 * firebase-admin pour rester testables avec `node --test`).
 */

/** Exige `request.auth.uid`, sinon `unauthenticated`. */
export function requireUid(request: { auth?: { uid: string } }): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Connexion requise");
  }
  return request.auth.uid;
}

/** `details.reason` renvoyé quand l'e-mail du compte n'est pas confirmé. */
export const EMAIL_NOT_VERIFIED_REASON = "email_not_verified";

/**
 * Exige un e-mail confirmé (`email_verified`) avant d'accepter une invitation
 * nominative : sinon, quelqu'un qui crée un compte avec l'adresse invitée
 * avant la vraie personne prend l'invitation. Google et Apple fournissent déjà
 * une adresse vérifiée ; un compte e-mail / mot de passe doit cliquer le lien
 * de confirmation (proposé par l'app et le portail sur cette erreur).
 */
export function requireVerifiedEmail(request: {
  auth?: { token?: { email_verified?: unknown } };
}): void {
  if (request.auth?.token?.email_verified === true) return;
  throw new HttpsError(
    "failed-precondition",
    "Confirme ton adresse e-mail pour accepter l'invitation",
    { reason: EMAIL_NOT_VERIFIED_REASON },
  );
}

/** Exige une chaîne non vide (trim), sinon `invalid-argument`. */
export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `${name} requis`);
  }
  return value.trim();
}

/** Normalisation e-mail commune (trim + lowercase). */
export function normalizeEmail(email: unknown): string {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/** Filtre un tableau Firestore inconnu en liste de chaînes non vides. */
export function stringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

/** Dédoublonne en conservant l'ordre. */
export function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

/** Lecture tolérante de `request.auth.token.email`. */
export function authEmailOf(request: {
  auth?: { token?: { email?: unknown } };
}): string {
  return normalizeEmail(request.auth?.token?.email);
}
