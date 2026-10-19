import { HttpsError } from "firebase-functions/v2/https";

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

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

/** Membre candidat au claim silencieux (fiche non liée). */
export type ClaimableMember = {
  memberId: string;
  accountUid: string | null;
  firstName: string;
  lastName: string;
  email: string;
  teamIds: string[];
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

/** True si la fiche a déjà un compte Auth lié. */
export function memberHasLinkedAccount(data: Record<string, unknown>): boolean {
  const accountUid = String(data.accountUid ?? "").trim();
  if (accountUid) return true;
  // Legacy : userId = Auth uid seulement s’il diffère du memberId doc.
  const userId = String(data.userId ?? "").trim();
  const memberId = String(data.memberId ?? "").trim();
  return Boolean(userId && userId !== memberId);
}

/**
 * Choisit la fiche à claimer : e-mail exact prioritaire, sinon prénom+nom unique.
 * Retourne `null` si aucun match sûr (pas de match, ou homonymes).
 */
export function resolveClaimMemberId(params: {
  members: ClaimableMember[];
  authEmail: string;
  firstName: string;
  lastName: string;
}): string | null {
  const email = normalizeEmail(params.authEmail);
  const nameKey = personNameKey(params.firstName, params.lastName);

  const unclaimed = params.members.filter((member) => !member.accountUid);

  if (email) {
    const byEmail = unclaimed.filter((member) => member.email === email);
    if (byEmail.length === 1) return byEmail[0]!.memberId;
    if (byEmail.length > 1) return null;
  }

  if (!nameKey) return null;
  const byName = unclaimed.filter(
    (member) => personNameKey(member.firstName, member.lastName) === nameKey,
  );
  if (byName.length === 1) return byName[0]!.memberId;
  return null;
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
