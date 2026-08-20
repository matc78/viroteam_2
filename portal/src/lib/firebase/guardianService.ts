import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import {
  inviteGuardian as inviteGuardianCallable,
  linkGuardian as linkGuardianCallable,
  revokeGuardian as revokeGuardianCallable,
  updateGuardianInviteEmail as updateGuardianInviteEmailCallable,
  extendGuardianInvite as extendGuardianInviteCallable,
  regenerateGuardianInvite as regenerateGuardianInviteCallable,
} from "./callableService";
import {
  Collections,
  Fields,
  GuardianStatuses,
  InvitationStatus,
  InvitationTypes,
} from "./constants";
import { getClubMember } from "./memberService";
import { toDate } from "./types";
import {
  listClubParentRows,
  type ClubParentRow,
} from "@/lib/members/parentsView";

export type { ClubParentRow };
export { listClubParentRows };

/** Vue parent affichée sur la fiche membre admin. */
export type MemberGuardianView = {
  parentUid: string | null;
  status: "active" | "pending" | null;
  displayName: string | null;
  email: string | null;
  invitationId: string | null;
  invitationCode: string | null;
  expiresAt: Date | null;
  inviteExpired: boolean;
};

function guardiansCol(clubId: string, memberId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.members,
    memberId,
    Collections.guardians,
  );
}

function invitationsCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.invitations,
  );
}

/**
 * Charge le parent V1 (0 ou 1) d’une fiche : guardian active/pending, sinon invitation.
 */
export async function getMemberGuardian(
  clubId: string,
  memberId: string,
): Promise<MemberGuardianView> {
  const empty: MemberGuardianView = {
    parentUid: null,
    status: null,
    displayName: null,
    email: null,
    invitationId: null,
    invitationCode: null,
    expiresAt: null,
    inviteExpired: false,
  };

  const guardiansSnap = await getDocs(guardiansCol(clubId, memberId));
  const occupying = guardiansSnap.docs.find((guardianDoc) => {
    const status = String(guardianDoc.data()[Fields.status] ?? "");
    return (
      status === GuardianStatuses.active || status === GuardianStatuses.pending
    );
  });

  if (occupying) {
    const data = occupying.data() as Record<string, unknown>;
    const status =
      String(data[Fields.status] ?? GuardianStatuses.pending) ===
      GuardianStatuses.active
        ? "active"
        : "pending";
    const userSnap = await getDoc(
      doc(getAppFirestore(), Collections.users, occupying.id),
    );
    let displayName: string | null = null;
    let email: string | null = null;
    if (userSnap.exists()) {
      const user = userSnap.data() as Record<string, unknown>;
      displayName =
        String(user[Fields.displayName] ?? "").trim() ||
        [user[Fields.firstName], user[Fields.lastName]]
          .map((part) => String(part ?? "").trim())
          .filter(Boolean)
          .join(" ") ||
        null;
      email = String(user[Fields.email] ?? "").trim() || null;
    }
    return {
      parentUid: occupying.id,
      status,
      displayName,
      email,
      invitationId: null,
      invitationCode: null,
      expiresAt: null,
      inviteExpired: false,
    };
  }

  const invitesSnap = await getDocs(
    query(
      invitationsCol(clubId),
      where(Fields.memberId, "==", memberId),
      where(Fields.status, "==", InvitationStatus.pending),
    ),
  );
  const pendingInvite = invitesSnap.docs.find(
    (inviteDoc) =>
      String(inviteDoc.data()[Fields.type] ?? "") === InvitationTypes.guardian,
  );
  if (!pendingInvite) return empty;

  const invite = pendingInvite.data() as Record<string, unknown>;
  const expiresAt = toDate(invite[Fields.expiresAt]);
  const inviteExpired = Boolean(
    expiresAt && expiresAt.getTime() < Date.now(),
  );

  return {
    parentUid: null,
    status: "pending",
    displayName: null,
    email: String(invite[Fields.email] ?? "").trim() || null,
    invitationId: pendingInvite.id,
    invitationCode: String(invite[Fields.code] ?? "").trim() || null,
    expiresAt,
    inviteExpired,
  };
}

/** Invite un parent (e-mail) sur la fiche joueur. */
export async function inviteMemberGuardian(params: {
  clubId: string;
  memberId: string;
  email: string;
}): Promise<{
  invitationId: string;
  code: string;
  expiresAt: string;
}> {
  const result = await inviteGuardianCallable(params);
  return {
    invitationId: result.invitationId,
    code: result.code,
    expiresAt: result.expiresAt,
  };
}

/** Révoque le parent V1 de la fiche. */
export async function revokeMemberGuardian(params: {
  clubId: string;
  memberId: string;
  parentUid?: string | null;
}): Promise<void> {
  await revokeGuardianCallable({
    clubId: params.clubId,
    memberId: params.memberId,
    parentUid: params.parentUid ?? undefined,
  });
}

/** Change l’e-mail d’une invitation parent pending. */
export async function updateMemberGuardianInviteEmail(params: {
  clubId: string;
  memberId: string;
  email: string;
  invitationId?: string;
}): Promise<void> {
  await updateGuardianInviteEmailCallable(params);
}

/** Prolonge une invitation parent pending. */
export async function extendMemberGuardianInvite(params: {
  clubId: string;
  memberId: string;
  invitationId?: string;
}): Promise<{ code: string; expiresAt: Date }> {
  const result = await extendGuardianInviteCallable(params);
  return {
    code: result.code,
    expiresAt: new Date(result.expiresAt),
  };
}

/** Régénère le code d’une invitation parent pending. */
export async function regenerateMemberGuardianInvite(params: {
  clubId: string;
  memberId: string;
  invitationId?: string;
}): Promise<{ code: string; expiresAt: Date }> {
  const result = await regenerateGuardianInviteCallable(params);
  return {
    code: result.code,
    expiresAt: new Date(result.expiresAt),
  };
}

/** Réclame les invitations parent pending correspondant à l’e-mail connecté. */
export async function claimPendingGuardianInvites(emailNorm: string): Promise<number> {
  const email = emailNorm.trim().toLowerCase();
  if (!email) return 0;

  const snap = await getDocs(
    query(
      collectionGroup(getAppFirestore(), Collections.invitations),
      where(Fields.email, "==", email),
      where(Fields.status, "==", InvitationStatus.pending),
    ),
  );

  const guardianInvites = snap.docs.filter(
    (inviteDoc) =>
      String(inviteDoc.data()[Fields.type] ?? "") === InvitationTypes.guardian,
  );
  if (guardianInvites.length === 0) return 0;

  let claimed = 0;
  for (const inviteDoc of guardianInvites) {
    const clubId = inviteDoc.ref.parent.parent?.id;
    if (!clubId) continue;
    try {
      await linkGuardianCallable({
        clubId,
        invitationId: inviteDoc.id,
      });
      claimed += 1;
    } catch {
      // Invitation expirée / cap / e-mail : on continue les autres.
    }
  }
  return claimed;
}

/** Prénom d’une fiche enfant pour les puces famille. */
export async function childFirstName(
  clubId: string,
  memberId: string,
): Promise<string> {
  const member = await getClubMember(clubId, memberId);
  if (!member) return "Enfant";
  return member.firstName.trim() || member.displayName.split(" ")[0] || "Enfant";
}
