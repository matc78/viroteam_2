import { lookupInvitationByCode } from "./callableService";
import { InvitationTypes } from "./constants";

export type InvitationLookupResult = {
  invitationId: string;
  clubId: string;
  code: string;
  role: string;
  type: string;
  memberId: string;
  clubName: string;
  firstName?: string;
  lastName?: string;
  /** E-mail masqué renvoyé par le serveur — affichage uniquement. */
  emailHint?: string;
  expiresAt?: Date;
};

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
    role: invitation.role,
    type: invitation.type || InvitationTypes.member,
    memberId: invitation.memberId ?? "",
    clubName: invitation.clubName,
    firstName: invitation.firstName.trim() || undefined,
    lastName: invitation.lastName.trim() || undefined,
    emailHint: invitation.emailHint.trim() || undefined,
    expiresAt:
      expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined,
  };
}
