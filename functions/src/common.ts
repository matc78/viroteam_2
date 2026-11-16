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

/**
 * Uid du compte lié à une fiche membre (`accountUid`), sinon null. Une seule clé membre : quand il existe, il égale l'id de la
 * fiche. Fiche non liée ⇒ pas d'uid (jamais de repli sur l'id de fiche).
 */
export function accountUidOf(member: { accountUid?: unknown } | undefined | null): string | null {
  const accountUid = String(member?.accountUid ?? "").trim();
  return accountUid.length > 0 ? accountUid : null;
}

/** Champs d'une équipe qui listent des ids de fiche (effectif, coachs, invités). */
export const TEAM_ROSTER_FIELDS = ["playerIds", "coachIds", "pendingPlayerIds"] as const;

/** Lien parent d'un compte (`users/{uid}.parentLinks[]`). */
export type ParentLink = {
  clubId: string;
  memberId: string;
  relation: string;
  status: string;
};

/**
 * Lecture tolérante de `users/{uid}.parentLinks` (seul parseur) : liens
 * complets uniquement, `relation` « parent » et `status` « pending » par défaut.
 */
export function parseParentLinks(raw: unknown): ParentLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      clubId: String(item.clubId ?? ""),
      memberId: String(item.memberId ?? ""),
      relation: String(item.relation ?? "parent"),
      status: String(item.status ?? "pending"),
    }))
    .filter((link) => link.clubId.length > 0 && link.memberId.length > 0);
}

/** Dédoublonne en conservant l'ordre. */
export function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Nom affiché d'un profil `users` : `displayName`, sinon prénom + nom, sinon
 * l'e-mail du compte.
 */
export function resolvedDisplayName(
  userData: Record<string, unknown> | undefined,
  authEmail: string | undefined,
): string {
  const fromProfile = String(userData?.displayName ?? "").trim();
  if (fromProfile.length > 0) return fromProfile;
  const first = String(userData?.firstName ?? "").trim();
  const last = String(userData?.lastName ?? "").trim();
  const combined = `${first} ${last}`.trim();
  if (combined.length > 0) return combined;
  return authEmail?.trim() ?? "";
}

/** Lecture tolérante de `request.auth.token.email`. */
export function authEmailOf(request: {
  auth?: { token?: { email?: unknown } };
}): string {
  return normalizeEmail(request.auth?.token?.email);
}
