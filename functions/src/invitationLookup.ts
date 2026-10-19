import type { CallableRequest } from "firebase-functions/v2/https";
import { db, defineDualCallable } from "./db";
import {
  isExpired,
  maskEmail,
  parseLookupCodeArgs,
  toIsoOrNull,
} from "./invitationLookupUtils";
import {
  INVITATION_TYPE_TEAM,
  TEAM_INVITE_MAX_USES,
} from "./teamInviteUtils";

export { maskEmail, parseLookupCodeArgs } from "./invitationLookupUtils";

const INVITATION_STATUS_PENDING = "pending";
const INVITATION_TYPE_GUARDIAN = "guardian";
const INVITATION_TYPE_MEMBER = "member";

type LookupInvitationPayload = {
  clubId: string;
  invitationId: string;
  code: string;
  role: string;
  type: "member" | "guardian" | "team";
  status: "pending";
  firstName: string;
  lastName: string;
  emailHint: string | null;
  clubName: string;
  clubSport: string;
  memberId: string | null;
  expiresAt: string | null;
  teamId: string | null;
  teamName: string | null;
  useCount: number | null;
  maxUses: number | null;
};

type LookupInvitationResponse =
  | { found: false; reason?: "expired" | "exhausted" }
  | { found: true; invitation: LookupInvitationPayload };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Recherche publique d'une invitation par code (les clients n'ont plus le
 * droit de lire la collection group `invitations`). Ne renvoie JAMAIS
 * l'e-mail complet : uniquement `emailHint` masqué.
 * Prod → v2-prod ; `lookupInvitationByCodeDev` → v2-dev.
 */
async function handleLookupInvitationByCode(
  request: CallableRequest,
): Promise<LookupInvitationResponse> {
  const { code } = parseLookupCodeArgs(request.data);

  const snap = await db()
    .collectionGroup("invitations")
    .where("code", "==", code)
    .where("status", "==", INVITATION_STATUS_PENDING)
    .limit(1)
    .get();

  const inviteDoc = snap.docs[0];
  const clubId = inviteDoc?.ref.parent.parent?.id;
  if (!inviteDoc || !clubId) {
    return { found: false };
  }
  const invite = inviteDoc.data();

  if (isExpired(invite.expiresAt)) {
    return { found: false, reason: "expired" };
  }

  const memberId = str(invite.memberId) || null;
  let firstName = str(invite.firstName);
  let lastName = str(invite.lastName);
  let clubName = str(invite.clubName);
  let clubSport = str(invite.clubSport);

  const clubRef = db().collection("clubs").doc(clubId);

  // Complément depuis la fiche membre pré-créée si l'invitation ne porte pas les noms.
  if (memberId && (!firstName || !lastName)) {
    const memberSnap = await clubRef.collection("members").doc(memberId).get();
    if (memberSnap.exists) {
      const member = memberSnap.data() ?? {};
      firstName = firstName || str(member.firstName);
      lastName = lastName || str(member.lastName);
    }
  }

  // Complément depuis le doc club si nom/sport manquants sur l'invitation.
  if (!clubName || !clubSport) {
    const clubSnap = await clubRef.get();
    if (clubSnap.exists) {
      const club = clubSnap.data() ?? {};
      clubName = clubName || str(club.name);
      clubSport = clubSport || str(club.sport);
    }
  }

  const rawType = str(invite.type);
  const type =
    rawType === INVITATION_TYPE_GUARDIAN
      ? INVITATION_TYPE_GUARDIAN
      : rawType === INVITATION_TYPE_TEAM
        ? INVITATION_TYPE_TEAM
        : INVITATION_TYPE_MEMBER;

  let teamId = str(invite.teamId) || null;
  let teamName = str(invite.teamName) || null;
  if (type === INVITATION_TYPE_TEAM && teamId && !teamName) {
    const teamSnap = await clubRef.collection("teams").doc(teamId).get();
    if (teamSnap.exists) {
      teamName = str(teamSnap.data()?.name) || null;
    }
  }

  const useCountRaw = invite.useCount;
  const maxUsesRaw = invite.maxUses;
  const useCount =
    type === INVITATION_TYPE_TEAM && typeof useCountRaw === "number"
      ? useCountRaw
      : type === INVITATION_TYPE_TEAM
        ? 0
        : null;
  const maxUses =
    type === INVITATION_TYPE_TEAM && typeof maxUsesRaw === "number"
      ? maxUsesRaw
      : type === INVITATION_TYPE_TEAM
        ? TEAM_INVITE_MAX_USES
        : null;

  if (type === INVITATION_TYPE_TEAM && useCount != null && maxUses != null) {
    if (useCount >= maxUses) {
      return { found: false, reason: "exhausted" };
    }
  }

  return {
    found: true,
    invitation: {
      clubId,
      invitationId: inviteDoc.id,
      code: str(invite.code).toUpperCase() || code,
      role: str(invite.role) || "player",
      type,
      status: INVITATION_STATUS_PENDING,
      firstName,
      lastName,
      emailHint: maskEmail(invite.email),
      clubName,
      clubSport,
      memberId,
      expiresAt: toIsoOrNull(invite.expiresAt),
      teamId,
      teamName,
      useCount,
      maxUses,
    },
  };
}

export const {
  prod: lookupInvitationByCode,
  dev: lookupInvitationByCodeDev,
} = defineDualCallable(handleLookupInvitationByCode);
