import * as admin from "firebase-admin";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import {
  TEAM_ROSTER_FIELDS,
  accountUidOf,
  requireUid,
  resolvedDisplayName,
  stringArray,
} from "./common";
import { buildJoinUrl } from "./email";
import {
  ServerAnalyticsEvents,
  captureClubEvent,
  clubMemberCount,
} from "./analytics";
import { db, defineDualCallable } from "./db";
import { assertPermissionOrTeamCoach } from "./permissions";
import { adminIdsUpdate, type ClubAccess } from "./permissionsCatalog";
import {
  MemberRekeyError,
  readRekeyCore,
  rewriteMemberReferencesWithRetry,
  writeRekeyCore,
} from "./memberRekey";
import { mergeMemberDocs } from "./memberRekeyPlan";
import {
  INVITATION_STATUS_EXPIRED,
  INVITATION_STATUS_PENDING,
  INVITATION_TYPE_TEAM,
  TEAM_INVITE_MAX_USES,
  TEAM_INVITE_TTL_DAYS,
  type ClaimableMember,
  claimableMemberFromData,
  normalizeEmail,
  parseTeamInviteArgs,
  parseTeamInviteIdArgs,
  resolveClaimMemberId,
  teamInviteAcceptable,
} from "./teamInviteUtils";
import { newUniqueInviteCode } from "./inviteCodes";

/**
 * Droit `manageMembers`, ou coach de l'équipe quand le club active
 * `coachPermissions.canInvitePlayers`.
 */
function assertCanManageTeamInvite(
  clubId: string,
  uid: string,
  teamId: string,
): Promise<ClubAccess> {
  return assertPermissionOrTeamCoach({
    clubId,
    uid,
    permission: "manageMembers",
    teamIds: [teamId],
    coachFlag: "canInvitePlayers",
    message: "Réservé aux coaches de cette équipe autorisés à inviter",
  });
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
  const access = await assertCanManageTeamInvite(clubId, callerUid, teamId);

  const clubRef = db().collection("clubs").doc(clubId);
  const teamRef = clubRef.collection("teams").doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) {
    throw new HttpsError("not-found", "Équipe introuvable");
  }
  const teamName = String(teamSnap.data()?.name ?? "").trim() || "Équipe";
  const clubName = String(access.club.name ?? "").trim();
  const clubSport = String(access.club.sport ?? "").trim();

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

  const code = await newUniqueInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TEAM_INVITE_TTL_DAYS);
  const inviteRef = invitesRef.doc();
  batch.set(inviteRef, {
    code,
    type: INVITATION_TYPE_TEAM,
    teamId,
    teamName,
    status: INVITATION_STATUS_PENDING,
    maxUses: TEAM_INVITE_MAX_USES,
    useCount: 0,
    clubName,
    clubSport,
    sentBy: callerUid,
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
  await assertCanManageTeamInvite(clubId, callerUid, teamId);

  await inviteRef.update({
    status: INVITATION_STATUS_EXPIRED,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
}

/**
 * Fiches de l'équipe ciblée (effectif, coachs, joueurs en attente) : seules
 * candidates au claim d'un code d'équipe. Retourne aussi leurs ids.
 */
async function loadTeamClaimableMembers(
  clubId: string,
  teamId: string,
): Promise<{ members: ClaimableMember[]; teamMemberIds: string[] }> {
  const clubRef = db().collection("clubs").doc(clubId);
  const teamSnap = await clubRef.collection("teams").doc(teamId).get();
  const team = teamSnap.data() ?? {};
  const teamMemberIds = [
    ...new Set(TEAM_ROSTER_FIELDS.flatMap((field) => stringArray(team[field]))),
  ].filter((id) => !id.includes("/"));
  if (teamMemberIds.length === 0) return { members: [], teamMemberIds };
  const snaps = await db().getAll(
    ...teamMemberIds.map((id) => clubRef.collection("members").doc(id)),
  );
  const members = snaps
    .filter((snap) => snap.exists)
    .map((snap) => {
      const data = (snap.data() ?? {}) as Record<string, unknown>;
      return claimableMemberFromData(snap.id, data, accountUidOf(data));
    });
  return { members, teamMemberIds };
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

  // Une seule clé membre : déjà membre ⇔ members/{uid} existe.
  const alreadyMember = (await clubRef.collection("members").doc(uid).get()).exists;
  const userSnap = await userRef.get();
  const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
  const firstName = String(userData.firstName ?? "").trim();
  const lastName = String(userData.lastName ?? "").trim();
  const displayName = resolvedDisplayName(userData, authEmail);
  const avatarUrl =
    typeof userData.avatarUrl === "string" ? userData.avatarUrl : null;

  let claimMemberId: string | null = null;
  if (!alreadyMember) {
    const { members, teamMemberIds } = await loadTeamClaimableMembers(
      clubId,
      teamId,
    );
    // Conflit : e-mail déjà sur une fiche (de l'équipe) liée à un autre compte.
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
    // Claim restreint : fiche de l'équipe, sans droits, e-mail vérifié.
    claimMemberId = resolveClaimMemberId({
      members,
      teamMemberIds,
      authEmail: authEmailNorm,
      emailVerified: request.auth?.token.email_verified === true,
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

    // Une seule clé membre : la fiche du compte vit à `members/{uid}`. Une
    // fiche pré-créée revendiquée est re-clée sur l'uid.
    const memberRef = clubRef.collection("members").doc(uid);
    const rekeyFrom = claimMemberId;
    const [memberSnap, rekeyState] = await Promise.all([
      tx.get(memberRef),
      rekeyFrom
        ? readRekeyCore(tx, { firestore: db(), clubId, fromMemberId: rekeyFrom, uid })
        : Promise.resolve(null),
    ]);
    // Revérifié dans la transaction : la fiche reste réclamable (non liée,
    // sans droits ni équipe coachée, non anonymisée) au moment de l'écriture.
    const sourceData = rekeyState?.source.exists
      ? ((rekeyState.source.data() ?? {}) as Record<string, unknown>)
      : null;
    const sourceStillClaimable =
      sourceData != null &&
      resolveClaimMemberId({
        members: [
          claimableMemberFromData(rekeyFrom!, sourceData, accountUidOf(sourceData)),
        ],
        teamMemberIds: [rekeyFrom!],
        authEmail: authEmailNorm,
        emailVerified: request.auth?.token.email_verified === true,
      }) === rekeyFrom;
    const rekey = sourceStillClaimable ? rekeyState : null;
    const currentData = rekey
      ? rekey.target.exists
        ? mergeMemberDocs(rekey.source.data()!, rekey.target.data()!)
        : rekey.source.data()!
      : memberSnap.exists
        ? memberSnap.data()!
        : null;
    const wasMember = alreadyMember && currentData != null;
    const teamIds = stringArray(currentData?.teamIds);
    const alreadyInTeam = teamIds.includes(teamId);
    const playerIds = stringArray(teamTx.data()?.playerIds);
    const alreadyOnRoster =
      playerIds.includes(uid) || (rekey != null && playerIds.includes(rekey.fromMemberId));
    const alreadyInTeamAndRoster = wasMember && alreadyInTeam && alreadyOnRoster;

    if (alreadyInTeamAndRoster && !rekey) {
      return { memberId: uid, alreadyInTeam: true, rekeyFrom: null };
    }

    if (rekey) {
      try {
        writeRekeyCore(tx, rekey, {
          extraFields: { ...profilePatch, teamIds: [...new Set([...teamIds, teamId])] },
          mergeDuplicates: true,
        });
      } catch (error) {
        if (error instanceof MemberRekeyError) {
          throw new HttpsError("failed-precondition", error.message);
        }
        throw error;
      }
    } else if (currentData) {
      // Fiche déjà à l'uid : on la lie au compte (seul lien : `accountUid`)
      // et elle entre dans l'index des admins si elle porte ce droit.
      tx.update(memberRef, {
        accountUid: uid,
        ...(alreadyInTeam
          ? {}
          : { teamIds: admin.firestore.FieldValue.arrayUnion(teamId) }),
        ...profilePatch,
      });
      const nextAdminIds = adminIdsUpdate({
        adminIds: stringArray(clubTx.data()?.adminIds),
        memberId: uid,
        linked: true,
        permissions: currentData.permissions,
      });
      if (nextAdminIds) {
        tx.update(clubRef, {
          adminIds: nextAdminIds,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } else {
      tx.set(memberRef, {
        accountUid: uid,
        firstName,
        lastName,
        permissions: [],
        coachTeamIds: [],
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
      const memberCount = Number(clubTx.data()?.memberCount ?? 0);
      tx.update(clubRef, {
        memberCount: memberCount + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    const appliedRekeyFrom = rekey ? rekeyFrom : null;

    if (alreadyInTeamAndRoster) {
      return { memberId: uid, alreadyInTeam: true, rekeyFrom: appliedRekeyFrom };
    }

    if (!alreadyOnRoster) {
      tx.update(teamRef, {
        playerIds: admin.firestore.FieldValue.arrayUnion(uid),
        pendingPlayerIds: admin.firestore.FieldValue.arrayRemove(
          ...[uid, appliedRekeyFrom].filter((id): id is string => Boolean(id)),
        ),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (!wasMember) {
      // `memberClubIds` : seul index des clubs du compte.
      if (!stringArray(userData.memberClubIds).includes(clubId)) {
        tx.set(
          userRef,
          {
            memberClubIds: admin.firestore.FieldValue.arrayUnion(clubId),
            flags: {
              profileCompleted: true,
              disabled: false,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }

    tx.update(inviteRef, {
      useCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      memberId: uid,
      alreadyInTeam: false,
      rekeyFrom: appliedRekeyFrom,
    };
  });

  if (result.rekeyFrom) {
    // Fiche déjà sous l'uid : relances immédiates, puis état incomplet
    // persistant repris par la tâche planifiée `scheduleMemberRekeyResume`.
    await rewriteMemberReferencesWithRetry({
      firestore: db(),
      clubId,
      from: result.rekeyFrom,
      uid,
    });
  }

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
