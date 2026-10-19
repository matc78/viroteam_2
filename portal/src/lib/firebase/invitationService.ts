import {
  acceptInvitation,
  acceptTeamInvitation,
  lookupInvitationByCode,
} from "./callableService";
import { InvitationTypes, MemberRoles } from "./constants";

/** Type d’invitation renvoyé par le lookup. */
export type InvitationType =
  (typeof InvitationTypes)[keyof typeof InvitationTypes];

/** Rôle membre normalisé pour une invitation. */
export type InvitationMemberRole =
  | typeof MemberRoles.player
  | typeof MemberRoles.coach
  | typeof MemberRoles.admin;

export type InvitationLookupResult = {
  invitationId: string;
  clubId: string;
  code: string;
  role: InvitationMemberRole;
  type: InvitationType;
  memberId: string;
  clubName: string;
  firstName?: string;
  lastName?: string;
  /** E-mail masqué renvoyé par le serveur — affichage uniquement. */
  emailHint?: string;
  expiresAt?: Date;
  teamId?: string;
  teamName?: string;
  useCount?: number;
  maxUses?: number;
};

/** Normalise le type d’invitation (défaut : membre). */
function normalizeInvitationType(raw: string): InvitationType {
  if (raw === InvitationTypes.guardian) return InvitationTypes.guardian;
  if (raw === InvitationTypes.team) return InvitationTypes.team;
  return InvitationTypes.member;
}

/** Normalise le rôle d’invitation membre (défaut : joueur). */
function normalizeInvitationRole(raw: string): InvitationMemberRole {
  if (raw === MemberRoles.coach) return MemberRoles.coach;
  if (raw === MemberRoles.admin) return MemberRoles.admin;
  return MemberRoles.player;
}

/** True si l’invitation est de type parent. */
export function isGuardianInvitation(
  invitation: InvitationLookupResult,
): invitation is InvitationLookupResult & {
  type: typeof InvitationTypes.guardian;
} {
  return invitation.type === InvitationTypes.guardian;
}

/** True si l’invitation est de type membre (joueur / coach / admin). */
export function isMemberInvitation(
  invitation: InvitationLookupResult,
): invitation is InvitationLookupResult & {
  type: typeof InvitationTypes.member;
} {
  return invitation.type === InvitationTypes.member;
}

/** True si l’invitation est un code d’équipe multi-usage. */
export function isTeamInvitation(
  invitation: InvitationLookupResult,
): invitation is InvitationLookupResult & {
  type: typeof InvitationTypes.team;
} {
  return invitation.type === InvitationTypes.team;
}

/**
 * Recherche une invitation active par code via la callable
 * `lookupInvitationByCode` (la lecture collection group par code est interdite
 * côté client par les règles Firestore).
 */
export async function findInvitationByCode(
  rawCode: string,
): Promise<InvitationLookupResult | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;

  const result = await lookupInvitationByCode({ code });
  if (!result.found) return null;

  const invitation = result.invitation;
  if (!invitation.clubId || !invitation.invitationId) return null;

  const expiresAt = invitation.expiresAt
    ? new Date(invitation.expiresAt)
    : null;

  return {
    invitationId: invitation.invitationId,
    clubId: invitation.clubId,
    code: invitation.code || code,
    role: normalizeInvitationRole(invitation.role),
    type: normalizeInvitationType(invitation.type),
    memberId: invitation.memberId ?? "",
    clubName: invitation.clubName,
    firstName: invitation.firstName.trim() || undefined,
    lastName: invitation.lastName.trim() || undefined,
    emailHint: invitation.emailHint?.trim() || undefined,
    expiresAt:
      expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined,
    teamId: invitation.teamId?.trim() || undefined,
    teamName: invitation.teamName?.trim() || undefined,
    useCount:
      typeof invitation.useCount === "number" ? invitation.useCount : undefined,
    maxUses:
      typeof invitation.maxUses === "number" ? invitation.maxUses : undefined,
  };
}

/**
 * Accepte l’invitation selon son type (membre nominatif ou code d’équipe).
 */
export async function acceptLookupInvitation(
  invitation: InvitationLookupResult,
): Promise<void> {
  if (isTeamInvitation(invitation)) {
    await acceptTeamInvitation({
      clubId: invitation.clubId,
      invitationId: invitation.invitationId,
    });
    return;
  }
  await acceptInvitation({
    clubId: invitation.clubId,
    invitationId: invitation.invitationId,
  });
}
