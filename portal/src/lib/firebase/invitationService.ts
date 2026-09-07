import { lookupInvitationByCode } from "./callableService";
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
};

/** Normalise le type d’invitation (défaut : membre). */
function normalizeInvitationType(raw: string): InvitationType {
  return raw === InvitationTypes.guardian
    ? InvitationTypes.guardian
    : InvitationTypes.member;
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
    emailHint: invitation.emailHint.trim() || undefined,
    expiresAt:
      expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined,
  };
}
