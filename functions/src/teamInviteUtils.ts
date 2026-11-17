import { HttpsError } from "firebase-functions/v2/https";
import { normalizeEmail } from "./common";

/** Plafond d’usages d’un code d’équipe multi-usage. */
export const TEAM_INVITE_MAX_USES = 30;

/** TTL par défaut (jours). */
export const TEAM_INVITE_TTL_DAYS = 7;

export const INVITATION_TYPE_TEAM = "team";
export const INVITATION_STATUS_PENDING = "pending";
export const INVITATION_STATUS_EXPIRED = "expired";

/**
 * Normalise prénom/nom pour matching claim : trim, minuscules, sans accents.
 */
export function normalizePersonName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Clé prénom+nom normalisés (vide si l’un des deux manque). */
export function personNameKey(firstName: unknown, lastName: unknown): string {
  const first = normalizePersonName(firstName);
  const last = normalizePersonName(lastName);
  if (!first || !last) return "";
  return `${first}|${last}`;
}

export { normalizeEmail };

/** Membre candidat au claim silencieux (fiche de l’équipe ciblée). */
export type ClaimableMember = {
  memberId: string;
  accountUid: string | null;
  firstName: string;
  lastName: string;
  email: string;
  teamIds: string[];
  /** Droits club de la fiche (`permissions`) : non vide ⇒ jamais réclamable. */
  permissions: string[];
  /** Équipes coachées (`coachTeamIds`) : non vide ⇒ jamais réclamable. */
  coachTeamIds: string[];
  /** Fiche anonymisée / archivée / supprimée ⇒ jamais réclamable. */
  retired: boolean;
};

/**
 * Extrait l’e-mail d’une fiche membre (`snapshot.email` ou `email` top-level).
 */
export function memberEmailFromData(data: Record<string, unknown>): string {
  const snapshot =
    data.snapshot && typeof data.snapshot === "object"
      ? (data.snapshot as Record<string, unknown>)
      : {};
  return (
    normalizeEmail(snapshot.email) ||
    normalizeEmail(data.email) ||
    ""
  );
}

/**
 * True si la fiche est anonymisée, archivée ou supprimée (suppression de
 * compte, retrait du club) : elle ne doit jamais être réclamée.
 */
export function memberIsRetired(data: Record<string, unknown>): boolean {
  return (
    data.anonymizedAt != null ||
    data.deletedAt != null ||
    data.deleted === true ||
    data.status === "archived" ||
    data.status === "deleted"
  );
}

function nonEmptyStrings(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
}

/**
 * Construit le candidat au claim depuis une fiche `members/{memberId}`.
 * [accountUid] est passé déjà résolu (`accountUidOf`).
 */
export function claimableMemberFromData(
  memberId: string,
  data: Record<string, unknown>,
  accountUid: string | null,
): ClaimableMember {
  return {
    memberId,
    accountUid,
    firstName: String(data.firstName ?? "").trim(),
    lastName: String(data.lastName ?? "").trim(),
    email: memberEmailFromData(data),
    teamIds: nonEmptyStrings(data.teamIds),
    permissions: nonEmptyStrings(data.permissions),
    coachTeamIds: nonEmptyStrings(data.coachTeamIds),
    retired: memberIsRetired(data),
  };
}

/**
 * Choisit la fiche pré-inscrite à réclamer lors de l’acceptation d’un code
 * d’équipe. Revue sécurité (17 nov. 2026) : un code d’équipe circule
 * largement, le claim est donc restreint au strict nécessaire :
 * - seulement les fiches de l’équipe ciblée ([teamMemberIds]) ;
 * - jamais une fiche liée, portant des droits club ou des équipes coachées
 *   (sinon héritage de droits), ni une fiche anonymisée / archivée ;
 * - uniquement par e-mail exact **vérifié** (`email_verified`), et unique.
 * Le prénom + nom (écrits librement par le client dans `users/{uid}`) ne
 * suffisent plus : sans e-mail vérifié correspondant, aucun claim (une fiche
 * neuve est créée ; un admin fusionne si besoin).
 * Retourne `null` si aucun match sûr.
 */
export function resolveClaimMemberId(params: {
  members: ClaimableMember[];
  teamMemberIds: readonly string[];
  authEmail: string;
  emailVerified: boolean;
}): string | null {
  if (!params.emailVerified) return null;
  const email = normalizeEmail(params.authEmail);
  if (!email) return null;
  const onTeam = new Set(params.teamMemberIds);

  const byEmail = params.members.filter(
    (member) =>
      onTeam.has(member.memberId) &&
      !member.accountUid &&
      member.permissions.length === 0 &&
      member.coachTeamIds.length === 0 &&
      !member.retired &&
      member.email === email,
  );
  return byEmail.length === 1 ? byEmail[0]!.memberId : null;
}

/** Parse `{ clubId, teamId, forceRefresh? }` pour create/refresh. */
export function parseTeamInviteArgs(data: unknown): {
  clubId: string;
  teamId: string;
  forceRefresh: boolean;
} {
  const payload = (data ?? {}) as Record<string, unknown>;
  const clubId =
    typeof payload.clubId === "string" ? payload.clubId.trim() : "";
  const teamId =
    typeof payload.teamId === "string" ? payload.teamId.trim() : "";
  if (!clubId || !teamId) {
    throw new HttpsError("invalid-argument", "clubId et teamId requis");
  }
  return {
    clubId,
    teamId,
    forceRefresh: payload.forceRefresh === true,
  };
}

/** Parse `{ clubId, invitationId }` pour accept/revoke team. */
export function parseTeamInviteIdArgs(data: unknown): {
  clubId: string;
  invitationId: string;
} {
  const payload = (data ?? {}) as Record<string, unknown>;
  const clubId =
    typeof payload.clubId === "string" ? payload.clubId.trim() : "";
  const invitationId =
    typeof payload.invitationId === "string"
      ? payload.invitationId.trim()
      : "";
  if (!clubId || !invitationId) {
    throw new HttpsError(
      "invalid-argument",
      "clubId et invitationId requis",
    );
  }
  return { clubId, invitationId };
}

/** True si le code d’équipe peut encore être utilisé. */
export function teamInviteAcceptable(params: {
  status: unknown;
  type: unknown;
  expiresAt: unknown;
  useCount: unknown;
  maxUses: unknown;
  nowMs?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (String(params.type ?? "") !== INVITATION_TYPE_TEAM) {
    return { ok: false, reason: "Pas une invitation d’équipe" };
  }
  if (String(params.status ?? "") !== INVITATION_STATUS_PENDING) {
    return { ok: false, reason: "Invitation inactive" };
  }
  const nowMs = params.nowMs ?? Date.now();
  const expiresAt = params.expiresAt as { toDate?: () => Date } | Date | null;
  let expiresMs: number | null = null;
  if (expiresAt instanceof Date) {
    expiresMs = expiresAt.getTime();
  } else if (expiresAt && typeof expiresAt.toDate === "function") {
    expiresMs = expiresAt.toDate().getTime();
  }
  if (expiresMs != null && nowMs > expiresMs) {
    return { ok: false, reason: "Invitation expirée" };
  }
  const useCount = Number(params.useCount ?? 0);
  const maxUses = Number(params.maxUses ?? TEAM_INVITE_MAX_USES);
  if (!Number.isFinite(useCount) || useCount < 0) {
    return { ok: false, reason: "Compteur invalide" };
  }
  if (useCount >= maxUses) {
    return { ok: false, reason: "Ce code a atteint sa limite" };
  }
  return { ok: true };
}
