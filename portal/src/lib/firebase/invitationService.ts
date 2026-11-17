import {
  acceptInvitation,
  acceptTeamInvitation,
  lookupInvitationByCode,
} from "./callableService";
import type { LookupInvitationResult } from "./callableService";
import { InvitationTypes } from "./constants";
import {
  lookupFailureFromResult,
  type InvitationLookupFailure,
} from "@/lib/invitations/invitationLookupFailure";

/** Type d’invitation renvoyé par le lookup. */
export type InvitationType =
  (typeof InvitationTypes)[keyof typeof InvitationTypes];

export type InvitationLookupResult = {
  invitationId: string;
  clubId: string;
  code: string;
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

/** True si l’invitation est de type parent. */
export function isGuardianInvitation(
  invitation: InvitationLookupResult,
): invitation is InvitationLookupResult & {
  type: typeof InvitationTypes.guardian;
} {
  return invitation.type === InvitationTypes.guardian;
}

/** True si l’invitation est de type membre (fiche nominative pré-inscrite). */
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

/** Résultat d’une recherche de code : invitation, ou cause d’échec. */
export type InvitationCodeLookup =
  | { ok: true; invitation: InvitationLookupResult }
  | { ok: false; failure: InvitationLookupFailure };

/** Convertit la réponse `lookupInvitationByCode` en invitation ou cause d’échec. */
function invitationFromLookupResult(
  result: LookupInvitationResult,
  code: string,
): InvitationCodeLookup {
  if (!result.found) {
    return { ok: false, failure: lookupFailureFromResult(result) };
  }

  const invitation = result.invitation;
  if (!invitation.clubId || !invitation.invitationId) {
    return { ok: false, failure: "error" };
  }

  const expiresAt = invitation.expiresAt
    ? new Date(invitation.expiresAt)
    : null;

  return {
    ok: true,
    invitation: {
      invitationId: invitation.invitationId,
      clubId: invitation.clubId,
      code: invitation.code || code,
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
    },
  };
}

/**
 * Recherche une invitation active par code via la callable
 * `lookupInvitationByCode` (la lecture collection group par code est interdite
 * côté client par les règles Firestore). Distingue code introuvable, expiré,
 * épuisé et erreur technique (réseau, service) — jamais d’exception.
 */
export async function lookupInvitationCode(
  rawCode: string,
): Promise<InvitationCodeLookup> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, failure: "notFound" };
  try {
    return invitationFromLookupResult(await lookupInvitationByCode({ code }), code);
  } catch {
    return { ok: false, failure: "error" };
  }
}

/**
 * Recherche une invitation active par code ; null si introuvable, expirée
 * ou épuisée. Propage les erreurs techniques (réseau, service).
 */
export async function findInvitationByCode(
  rawCode: string,
): Promise<InvitationLookupResult | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const lookup = invitationFromLookupResult(
    await lookupInvitationByCode({ code }),
    code,
  );
  return lookup.ok ? lookup.invitation : null;
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
