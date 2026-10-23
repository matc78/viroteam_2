import * as admin from "firebase-admin";
import type { DocumentData } from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { stringArray } from "./common";
import { buildJoinUrl } from "./email";
import {
  ServerAnalyticsEvents,
  captureClubEvent,
  clubMemberCount,
} from "./analytics";
import { db, defineDualCallable } from "./db";
import { assertClubAdmin } from "./guardians";
import {
  INVITATION_STATUS_EXPIRED,
  INVITATION_STATUS_PENDING,
  INVITATION_TYPE_TEAM,
  TEAM_INVITE_MAX_USES,
  TEAM_INVITE_TTL_DAYS,
  type ClaimableMember,
  memberEmailFromData,
  memberHasLinkedAccount,
  normalizeEmail,
  parseTeamInviteArgs,
  parseTeamInviteIdArgs,
  resolveClaimMemberId,
  teamInviteAcceptable,
} from "./teamInviteUtils";

const ROLE_PLAYER = "player";
const ROLE_COACH = "coach";
const ROLE_ADMIN = "admin";

type TeamInviteCaller = {
  club: DocumentData;
  uid: string;
  memberId: string;
  isAdmin: boolean;
};

function generateInviteCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function requireUid(request: { auth?: { uid: string } }): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Connexion requise");
  }
  return request.auth.uid;
}

function resolvedDisplayName(
  userData: Record<string, unknown>,
  authEmail: string | undefined,
): string {
  const fromProfile = String(userData.displayName ?? "").trim();
  if (fromProfile.length > 0) return fromProfile;
  const first = String(userData.firstName ?? "").trim();
  const last = String(userData.lastName ?? "").trim();
  const combined = `${first} ${last}`.trim();
  if (combined.length > 0) return combined;
  return authEmail?.trim() ?? "";
}

/**
 * Admin club, ou coach club avec `coachPermissions.canInvitePlayers`.
 * La contrainte « coach de l’équipe » est vérifiée via [assertCallerCoachesTeam].
 */
async function resolveTeamInviteCaller(
  clubId: string,
  uid: string,
): Promise<TeamInviteCaller> {
  try {
    const club = await assertClubAdmin(clubId, uid);
    return { club, uid, memberId: uid, isAdmin: true };
  } catch (error) {
    if (!(error instanceof HttpsError) || error.code !== "permission-denied") {
      throw error;
    }
  }

  const clubRef = db().collection("clubs").doc(clubId);
  const clubSnap = await clubRef.get();
  if (!clubSnap.exists) {
    throw new HttpsError("not-found", "Club introuvable");
  }
  const club = clubSnap.data()!;

  const accountSnap = await clubRef.collection("member_accounts").doc(uid).get();
  const linkedMemberId = accountSnap.exists
    ? String(accountSnap.data()?.memberId ?? "").trim()
    : "";
  const memberId = linkedMemberId || uid;
  const memberSnap = await clubRef.collection("members").doc(memberId).get();
  if (!memberSnap.exists) {
    throw new HttpsError(
      "permission-denied",
      "Réservé aux coaches ou admins du club",
    );
  }
  const role = String(memberSnap.data()?.role ?? "");
  if (role !== ROLE_COACH && role !== ROLE_ADMIN) {
    throw new HttpsError(
      "permission-denied",
      "Réservé aux coaches ou admins du club",
    );
  }

  const rawPerms =
    club.coachPermissions && typeof club.coachPermissions === "object"
      ? (club.coachPermissions as Record<string, unknown>)
      : {};
  const canInvite =
    rawPerms.canInvitePlayers === undefined
      ? true
      : Boolean(rawPerms.canInvitePlayers);
  if (role === ROLE_COACH && !canInvite) {
    throw new HttpsError(
      "permission-denied",
      "Tu n’as pas le droit d’inviter des joueurs",
    );
  }

  return {
    club,
    uid,
    memberId,
    isAdmin: role === ROLE_ADMIN,
  };
}

/** Exige admin club ou présence du caller dans `team.coachIds`. */
function assertCallerCoachesTeam(
  caller: TeamInviteCaller,
  teamData: DocumentData | undefined,
): void {
  if (caller.isAdmin) return;
  const coachIds = stringArray(teamData?.coachIds);
  if (
    !coachIds.includes(caller.uid) &&
    !coachIds.includes(caller.memberId)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Réservé aux coaches de cette équipe",
    );
  }
}

type TeamInviteResponse = {
  ok: true;
  clubId: string;
  teamId: string;
  invitationId: string;
  code: string;
  expiresAt: string;
  useCount: number;
  maxUses: number;
  joinUrl: string;
  teamName: string;
};

function toInviteResponse(params: {
  clubId: string;
  teamId: string;
  invitationId: string;
  code: string;
  expiresAt: Date;
  useCount: number;
  maxUses: number;
  teamName: string;
}): TeamInviteResponse {
  return {
    ok: true,
    clubId: params.clubId,
    teamId: params.teamId,
    invitationId: params.invitationId,
    code: params.code,
    expiresAt: params.expiresAt.toISOString(),
    useCount: params.useCount,
    maxUses: params.maxUses,
    joinUrl: buildJoinUrl(params.code),
    teamName: params.teamName,
  };
}

/**
 * Crée ou renvoie le code d’équipe multi-usage (7j, max 30).
 * `forceRefresh: true` expire l’ancien et en génère un nouveau.
 */
async function handleCreateOrRefreshTeamInvite(
  request: CallableRequest,
): Promise<TeamInviteResponse> {
  const callerUid = requireUid(request);
  const { clubId, teamId, forceRefresh } = parseTeamInviteArgs(request.data);
  const caller = await resolveTeamInviteCaller(clubId, callerUid);

  const clubRef = db().collection("clubs").doc(clubId);
  const teamRef = clubRef.collection("teams").doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) {
    throw new HttpsError("not-found", "Équipe introuvable");
  }
  assertCallerCoachesTeam(caller, teamSnap.data());
  const teamName = String(teamSnap.data()?.name ?? "").trim() || "Équipe";
  const clubName = String(caller.club.name ?? "").trim();
  const clubSport = String(caller.club.sport ?? "").trim();

  const invitesRef = clubRef.collection("invitations");
  const existingSnap = await invitesRef
    .where("type", "==", INVITATION_TYPE_TEAM)
    .where("teamId", "==", teamId)
    .where("status", "==", INVITATION_STATUS_PENDING)
    .limit(5)
    .get();

  if (!forceRefresh && !existingSnap.empty) {
    const doc = existingSnap.docs[0]!;
    const data = doc.data();
    const check = teamInviteAcceptable({
      status: data.status,
      type: data.type,
      expiresAt: data.expiresAt,
      useCount: data.useCount,
      maxUses: data.maxUses,
    });
    if (check.ok) {
      const expiresAt =
        data.expiresAt?.toDate?.() instanceof Date
          ? (data.expiresAt.toDate() as Date)
          : new Date(Date.now() + TEAM_INVITE_TTL_DAYS * 86400000);
      return toInviteResponse({
        clubId,
        teamId,
        invitationId: doc.id,
        code: String(data.code ?? "").toUpperCase(),
        expiresAt,
        useCount: Number(data.useCount ?? 0),
        maxUses: Number(data.maxUses ?? TEAM_INVITE_MAX_USES),
        teamName: String(data.teamName ?? teamName),
      });
    }
  }

  const batch = db().batch();
  for (const doc of existingSnap.docs) {
    batch.update(doc.ref, {
      status: INVITATION_STATUS_EXPIRED,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const code = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TEAM_INVITE_TTL_DAYS);
  const inviteRef = invitesRef.doc();
  batch.set(inviteRef, {
    code,
    type: INVITATION_TYPE_TEAM,
    teamId,
    teamName,
    role: ROLE_PLAYER,
    status: INVITATION_STATUS_PENDING,
    maxUses: TEAM_INVITE_MAX_USES,
    useCount: 0,
    clubName,
    clubSport,
    sentBy: caller.uid,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
  await captureClubEvent({
    clubId,
    event: ServerAnalyticsEvents.invitationSent,
    properties: { kind: "team_code", refreshed: !existingSnap.empty },
  });

  return toInviteResponse({
    clubId,
    teamId,
    invitationId: inviteRef.id,
    code,
    expiresAt,
    useCount: 0,
    maxUses: TEAM_INVITE_MAX_USES,
    teamName,
  });
}

/**
 * Révoque (expire) le code d’équipe actif.
 */
async function handleRevokeTeamInvite(
  request: CallableRequest,
): Promise<{ ok: true }> {
  const callerUid = requireUid(request);
  const { clubId, invitationId } = parseTeamInviteIdArgs(request.data);
  const caller = await resolveTeamInviteCaller(clubId, callerUid);

  const clubRef = db().collection("clubs").doc(clubId);
  const inviteRef = clubRef.collection("invitations").doc(invitationId);
  const snap = await inviteRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Invitation introuvable");
  }
  const data = snap.data()!;
  if (String(data.type ?? "") !== INVITATION_TYPE_TEAM) {
    throw new HttpsError(
      "failed-precondition",
      "Pas une invitation d’équipe",
    );
  }
  const teamId = String(data.teamId ?? "").trim();
  if (!teamId) {
    throw new HttpsError("failed-precondition", "Équipe manquante sur l’invitation");
  }
  const teamSnap = await clubRef.collection("teams").doc(teamId).get();
  if (!teamSnap.exists) {
    throw new HttpsError("not-found", "Équipe introuvable");
  }
  assertCallerCoachesTeam(caller, teamSnap.data());

  await inviteRef.update({
    status: INVITATION_STATUS_EXPIRED,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
}

async function loadClaimableMembers(clubId: string): Promise<ClaimableMember[]> {
  const snap = await db()
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .get();
  return snap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const linked = memberHasLinkedAccount(data);
    const accountUid = linked
      ? String(data.accountUid ?? data.userId ?? "").trim() || null
      : null;
    const teamIds = Array.isArray(data.teamIds)
      ? (data.teamIds as unknown[]).filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [];
    return {
      memberId: doc.id,
      accountUid,
      firstName: String(data.firstName ?? "").trim(),
      lastName: String(data.lastName ?? "").trim(),
      email: memberEmailFromData(data),
      teamIds,
    };
  });
}

async function resolveExistingMemberId(
  clubId: string,
  uid: string,
): Promise<string | null> {
  const accountSnap = await db()
    .collection("clubs")
    .doc(clubId)
    .collection("member_accounts")
    .doc(uid)
    .get();
  if (accountSnap.exists) {
    const linked = String(accountSnap.data()?.memberId ?? "").trim();
    if (linked) return linked;
  }
  const selfSnap = await db()
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(uid)
    .get();
  if (selfSnap.exists) return uid;
  return null;
}

/**
 * Accepte un code d’équipe : claim/create membre + roster immédiat.
 */
async function handleAcceptTeamInvitation(
  request: CallableRequest,
): Promise<{ ok: true; memberId: string; alreadyInTeam: boolean }> {
  const uid = requireUid(request);
  const authEmail = request.auth?.token.email as string | undefined;
  const authEmailNorm = normalizeEmail(authEmail ?? "");
  if (!authEmailNorm) {
    throw new HttpsError(
      "failed-precondition",
      "E-mail du compte introuvable — reconnecte-toi avec un compte e-mail",
    );
  }
  const { clubId, invitationId } = parseTeamInviteIdArgs(request.data);

  const clubRef = db().collection("clubs").doc(clubId);
  const inviteRef = clubRef.collection("invitations").doc(invitationId);
  const userRef = db().collection("users").doc(uid);

  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new HttpsError("not-found", "Invitation introuvable");
  }
  const invitePre = inviteSnap.data()!;
  const preCheck = teamInviteAcceptable({
    status: invitePre.status,
    type: invitePre.type,
    expiresAt: invitePre.expiresAt,
    useCount: invitePre.useCount,
    maxUses: invitePre.maxUses,
  });
  if (!preCheck.ok) {
    throw new HttpsError("failed-precondition", preCheck.reason);
  }

  const teamId = String(invitePre.teamId ?? "").trim();
  if (!teamId) {
    throw new HttpsError("failed-precondition", "Invitation sans équipe");
  }
  const teamRef = clubRef.collection("teams").doc(teamId);

  const existingMemberId = await resolveExistingMemberId(clubId, uid);
  const userSnap = await userRef.get();
  const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
  const firstName = String(userData.firstName ?? "").trim();
  const lastName = String(userData.lastName ?? "").trim();
  const displayName = resolvedDisplayName(userData, authEmail);
  const avatarUrl =
    typeof userData.avatarUrl === "string" ? userData.avatarUrl : null;

  let claimMemberId: string | null = null;
  if (!existingMemberId) {
    const members = await loadClaimableMembers(clubId);
    // Conflit : e-mail déjà sur une fiche liée à un autre compte.
    const emailConflict = members.find(
      (member) =>
        member.email === authEmailNorm &&
        member.accountUid &&
        member.accountUid !== uid,
    );
    if (emailConflict) {
      throw new HttpsError(
        "failed-precondition",
        "Cet e-mail est déjà lié à un autre compte du club",
      );
    }
    claimMemberId = resolveClaimMemberId({
      members,
      authEmail: authEmailNorm,
      firstName,
      lastName,
    });
  }

  const result = await db().runTransaction(async (tx) => {
    const [inviteTx, teamTx, clubTx] = await Promise.all([
      tx.get(inviteRef),
      tx.get(teamRef),
      tx.get(clubRef),
    ]);

    if (!inviteTx.exists) {
      throw new HttpsError("not-found", "Invitation introuvable");
    }
    if (!teamTx.exists) {
      throw new HttpsError("not-found", "Équipe introuvable");
    }
    const invite = inviteTx.data()!;
    const check = teamInviteAcceptable({
      status: invite.status,
      type: invite.type,
      expiresAt: invite.expiresAt,
      useCount: invite.useCount,
      maxUses: invite.maxUses,
    });
    if (!check.ok) {
      throw new HttpsError("failed-precondition", check.reason);
    }
    if (String(invite.teamId ?? "") !== teamId) {
      throw new HttpsError("failed-precondition", "Invitation sans équipe");
    }

    const profilePatch = {
      firstName,
      lastName,
      snapshot: {
        displayName,
        email: authEmailNorm,
        ...(avatarUrl ? { avatarUrl } : {}),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let memberId = existingMemberId;

    if (memberId) {
      const memberRef = clubRef.collection("members").doc(memberId);
      const memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists) {
        throw new HttpsError("not-found", "Membre du club introuvable");
      }
      const memberData = memberSnap.data()!;
      const teamIds = Array.isArray(memberData.teamIds)
        ? (memberData.teamIds as unknown[]).filter(
            (id): id is string => typeof id === "string",
          )
        : [];
      const alreadyInTeam = teamIds.includes(teamId);
      const playerIds = Array.isArray(teamTx.data()?.playerIds)
        ? (teamTx.data()!.playerIds as unknown[]).filter(
            (id): id is string => typeof id === "string",
          )
        : [];
      const alreadyOnRoster = playerIds.includes(memberId);

      if (alreadyInTeam && alreadyOnRoster) {
        return { memberId, alreadyInTeam: true };
      }

      if (!alreadyInTeam) {
        tx.update(memberRef, {
          teamIds: admin.firestore.FieldValue.arrayUnion(teamId),
          ...profilePatch,
        });
      } else {
        tx.update(memberRef, profilePatch);
      }
      if (!alreadyOnRoster) {
        tx.update(teamRef, {
          playerIds: admin.firestore.FieldValue.arrayUnion(memberId),
          pendingPlayerIds: admin.firestore.FieldValue.arrayRemove(memberId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      tx.update(inviteRef, {
        useCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { memberId, alreadyInTeam: false };
    }

    if (claimMemberId) {
      const memberRef = clubRef.collection("members").doc(claimMemberId);
      const memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists) {
        claimMemberId = null;
      } else {
        const data = memberSnap.data()!;
        if (memberHasLinkedAccount(data as Record<string, unknown>)) {
          const linkedUid = String(data.accountUid ?? data.userId ?? "").trim();
          if (linkedUid && linkedUid !== uid) {
            throw new HttpsError(
              "failed-precondition",
              "Cette fiche est déjà liée à un autre compte",
            );
          }
        }
        memberId = claimMemberId;
        tx.update(memberRef, {
          accountUid: uid,
          userId: uid,
          teamIds: admin.firestore.FieldValue.arrayUnion(teamId),
          activeInvitationId: admin.firestore.FieldValue.delete(),
          ...profilePatch,
        });
        tx.set(clubRef.collection("member_accounts").doc(uid), {
          memberId: claimMemberId,
        });
      }
    }

    if (!memberId) {
      const memberRef = clubRef.collection("members").doc();
      memberId = memberRef.id;
      tx.set(memberRef, {
        memberId,
        accountUid: uid,
        userId: uid,
        firstName,
        lastName,
        role: ROLE_PLAYER,
        status: "active",
        teamIds: [teamId],
        snapshot: {
          displayName,
          email: authEmailNorm,
          ...(avatarUrl ? { avatarUrl } : {}),
        },
        playerInfo: { license: "" },
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(clubRef.collection("member_accounts").doc(uid), { memberId });
      const memberCount = Number(clubTx.data()?.memberCount ?? 0);
      tx.update(clubRef, {
        memberCount: memberCount + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    tx.update(teamRef, {
      playerIds: admin.firestore.FieldValue.arrayUnion(memberId),
      pendingPlayerIds: admin.firestore.FieldValue.arrayRemove(memberId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const memberships = Array.isArray(userData.clubMemberships)
      ? (userData.clubMemberships as unknown[]).filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object",
        )
      : [];
    const already = memberships.some((m) => String(m.clubId ?? "") === clubId);
    if (!already) {
      memberships.push({ clubId, role: ROLE_PLAYER });
      tx.set(
        userRef,
        {
          clubMemberships: memberships,
          flags: {
            profileCompleted: true,
            disabled: false,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    tx.update(inviteRef, {
      useCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      memberId,
      alreadyInTeam: false,
    };
  });

  await captureClubEvent({
    clubId,
    event: ServerAnalyticsEvents.joinCodeUsed,
    properties: {
      already_in_team: result.alreadyInTeam,
      member_count: await clubMemberCount(clubId),
    },
  });

  return {
    ok: true,
    memberId: result.memberId,
    alreadyInTeam: result.alreadyInTeam,
  };
}

export const {
  prod: createOrRefreshTeamInvite,
  dev: createOrRefreshTeamInviteDev,
} = defineDualCallable(handleCreateOrRefreshTeamInvite);

export const {
  prod: revokeTeamInvite,
  dev: revokeTeamInviteDev,
} = defineDualCallable(handleRevokeTeamInvite);

export const {
  prod: acceptTeamInvitation,
  dev: acceptTeamInvitationDev,
} = defineDualCallable(handleAcceptTeamInvitation);
