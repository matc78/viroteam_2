import * as admin from "firebase-admin";
import type {
  DocumentReference,
  Query,
  Transaction,
} from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db, defineDualCallable } from "./db";
import { requireUid, stringArray, uniq } from "./common";
import { assertClubAdmin } from "./guardians";
import {
  adminIdsWithout,
  decrementCount,
  accountUidOf,
  isLastAdmin,
  nextAdminIds,
  parseRemoveMemberArgs,
  parseResolveJoinRequestArgs,
  parseSetMemberRoleArgs,
  requestableRole,
  ROLE_ADMIN,
  ROLE_PLAYER,
  withMembershipRole,
  withoutMembership,
  type AdminMemberRef,
  type MemberRole,
} from "./memberAdminUtils";
import { recomputeParentTeamIdsSafe } from "./parentTeams";
import { ClubActivityTypes, logClubActivity } from "./clubActivity";

export {
  isLastAdmin,
  nextAdminIds,
  parseRemoveMemberArgs,
  parseSetMemberRoleArgs,
} from "./memberAdminUtils";

const INVITATION_STATUS_PENDING = "pending";
const INVITATION_STATUS_REVOKED = "revoked";
const JOIN_REQUEST_STATUS_PENDING = "pending";
const JOIN_REQUEST_STATUS_ACCEPTED = "accepted";
const JOIN_REQUEST_STATUS_REFUSED = "refused";
const TEAM_ROSTER_FIELDS = ["playerIds", "coachIds", "pendingPlayerIds"] as const;

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

/** Fiches `role == admin` du club (lues dans la transaction). */
async function loadAdminMembers(
  tx: Transaction,
  clubId: string,
): Promise<AdminMemberRef[]> {
  const snap = await tx.get(
    db()
      .collection("clubs")
      .doc(clubId)
      .collection("members")
      .where("role", "==", ROLE_ADMIN) as Query,
  );
  return snap.docs.map((doc) => ({
    memberId: doc.id,
    accountUid: accountUidOf(doc.data()),
  }));
}

/**
 * Lit (dans [tx]) tout ce qu'il faut pour passer `memberId` à `newRole`,
 * applique la garde « dernier admin », puis renvoie les écritures à jouer.
 * Séparer lectures et écritures permet de combiner ce changement avec
 * d'autres écritures dans la même transaction (Firestore : lectures d'abord).
 */
async function prepareRoleChange(
  tx: Transaction,
  clubId: string,
  memberId: string,
  newRole: MemberRole,
): Promise<() => void> {
  const clubRef = db().collection("clubs").doc(clubId);
  const memberRef = clubRef.collection("members").doc(memberId);

  const [memberSnap, clubSnap, adminMembers] = await Promise.all([
    tx.get(memberRef),
    tx.get(clubRef),
    loadAdminMembers(tx, clubId),
  ]);
  if (!memberSnap.exists) {
    throw new HttpsError("not-found", "Membre introuvable");
  }
  if (!clubSnap.exists) {
    throw new HttpsError("not-found", "Club introuvable");
  }

  const member = memberSnap.data()!;
  const oldRole = String(member.role ?? ROLE_PLAYER);
  const accountUid = accountUidOf(member);
  const adminIds = stringArray(clubSnap.data()?.adminIds);
  const target: AdminMemberRef = { memberId, accountUid };

  if (
    oldRole === ROLE_ADMIN &&
    newRole !== ROLE_ADMIN &&
    isLastAdmin({ adminIds, adminMembers, target })
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Impossible de retirer le dernier administrateur",
    );
  }

  const userRef = accountUid ? db().collection("users").doc(accountUid) : null;
  const userSnap = userRef ? await tx.get(userRef) : null;

  return () => {
    if (oldRole !== newRole) {
      tx.update(memberRef, { role: newRole, updatedAt: serverTimestamp() });
    }

    const updatedAdminIds = nextAdminIds({ adminIds, accountUid, oldRole, newRole });
    if (
      updatedAdminIds.length !== adminIds.length ||
      updatedAdminIds.some((id, index) => id !== adminIds[index])
    ) {
      tx.update(clubRef, { adminIds: updatedAdminIds, updatedAt: serverTimestamp() });
    }

    if (userRef && userSnap?.exists) {
      tx.update(userRef, {
        clubMemberships: withMembershipRole(
          userSnap.data()?.clubMemberships,
          clubId,
          newRole,
        ),
        updatedAt: serverTimestamp(),
      });
    }
  };
}

/**
 * Change le rôle d'un membre. Appelant admin du club. Garde « dernier admin ».
 * Effets : `members/{memberId}.role`, `club.adminIds`, `users/{accountUid}.clubMemberships[].role`.
 * Prod → v2-prod ; `setMemberRoleDev` → v2-dev.
 */
async function handleSetMemberRole(
  request: CallableRequest,
): Promise<{ ok: true }> {
  const callerUid = requireUid(request);
  const { clubId, memberId, role: newRole } = parseSetMemberRoleArgs(request.data);
  await assertClubAdmin(clubId, callerUid);

  await db().runTransaction(async (tx) => {
    const commit = await prepareRoleChange(tx, clubId, memberId, newRole);
    commit();
  });

  return { ok: true };
}

/**
 * Accepte ou refuse une demande de rôle (`join_requests/{requestId}`).
 * Appelant admin du club de la demande. Accepter applique le rôle demandé
 * (player / coach) à la fiche du demandeur, dans la même transaction que le
 * passage de la demande à `accepted` ; refuser la passe à `refused`.
 * Refusé si la demande n'est plus en attente ou si le demandeur n'est pas
 * (encore) membre du club.
 * Prod → v2-prod ; `resolveJoinRequestDev` → v2-dev.
 */
async function handleResolveJoinRequest(
  request: CallableRequest,
): Promise<{ ok: true }> {
  const callerUid = requireUid(request);
  const { requestId, decision } = parseResolveJoinRequestArgs(request.data);
  const requestRef = db().collection("join_requests").doc(requestId);

  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) {
    throw new HttpsError("not-found", "Demande introuvable");
  }
  const clubId = String(requestSnap.data()?.clubId ?? "").trim();
  if (!clubId) {
    throw new HttpsError("failed-precondition", "Demande sans club");
  }
  await assertClubAdmin(clubId, callerUid);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(requestRef);
    const data = snap.data() ?? {};
    if (String(data.status ?? "") !== JOIN_REQUEST_STATUS_PENDING) {
      throw new HttpsError("failed-precondition", "Demande déjà traitée");
    }

    let commitRole: (() => void) | null = null;
    if (decision === "accept") {
      const role = requestableRole(data.roleRequested);
      if (!role) {
        throw new HttpsError("failed-precondition", "Rôle demandé invalide");
      }
      const requesterUid = String(data.userId ?? "").trim();
      const clubRef = db().collection("clubs").doc(clubId);
      const accountIndexSnap = await tx.get(
        clubRef.collection("member_accounts").doc(requesterUid),
      );
      const indexedMemberId = String(accountIndexSnap.data()?.memberId ?? "").trim();
      const memberId = indexedMemberId || requesterUid;
      const memberSnap = await tx.get(clubRef.collection("members").doc(memberId));
      if (!requesterUid || !memberSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Cette personne n'a pas encore rejoint le club.",
        );
      }
      commitRole = await prepareRoleChange(tx, clubId, memberId, role);
    }

    commitRole?.();
    tx.update(requestRef, {
      status:
        decision === "accept"
          ? JOIN_REQUEST_STATUS_ACCEPTED
          : JOIN_REQUEST_STATUS_REFUSED,
      resolvedBy: callerUid,
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return { ok: true };
}

/**
 * Détache les guardians d'une fiche supprimée : retire le lien du profil
 * parent (`parentLinks`, `parentClubIds`), supprime le doc guardian, puis
 * recalcule `parentTeamIds`. Best-effort (log + continue).
 */
async function detachGuardiansOfMember(
  clubId: string,
  memberId: string,
  guardianDocs: admin.firestore.QueryDocumentSnapshot[],
): Promise<void> {
  for (const guardianDoc of guardianDocs) {
    const parentUid = String(guardianDoc.data().parentUid ?? guardianDoc.id).trim();
    try {
      if (parentUid) {
        const userRef = db().collection("users").doc(parentUid);
        await db().runTransaction(async (tx) => {
          const userSnap = await tx.get(userRef);
          if (!userSnap.exists) return;
          const links = (Array.isArray(userSnap.data()?.parentLinks)
            ? (userSnap.data()!.parentLinks as unknown[])
            : []
          ).filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object",
          );
          const nextLinks = links.filter(
            (link) =>
              !(
                String(link.clubId ?? "") === clubId &&
                String(link.memberId ?? "") === memberId
              ),
          );
          const parentClubIds = uniq(
            nextLinks
              .filter((link) => String(link.status ?? "") === "active")
              .map((link) => String(link.clubId ?? ""))
              .filter((id) => id.length > 0),
          );
          tx.update(userRef, {
            parentLinks: nextLinks,
            parentClubIds,
            updatedAt: serverTimestamp(),
          });
        });
      }
      await guardianDoc.ref.delete();
      if (parentUid) {
        await recomputeParentTeamIdsSafe(db(), parentUid);
      }
    } catch (error) {
      console.error("removeMember: détachement guardian échoué", {
        clubId,
        memberId,
        parentUid,
        error,
      });
    }
  }
}

/**
 * Retire un membre du club. Appelant admin du club. Garde « dernier admin ».
 * Effets : suppression `members/{memberId}` et `member_accounts/{accountUid}`,
 * `club.adminIds`/`memberCount`, rosters `teams`, invitation pending → revoked,
 * `users/{accountUid}.clubMemberships` sans le club, guardians détachés.
 * Prod → v2-prod ; `removeMemberDev` → v2-dev.
 */
async function handleRemoveMember(
  request: CallableRequest,
): Promise<{ ok: true }> {
  const callerUid = requireUid(request);
  const { clubId, memberId } = parseRemoveMemberArgs(request.data);
  await assertClubAdmin(clubId, callerUid);

  const clubRef = db().collection("clubs").doc(clubId);
  const memberRef = clubRef.collection("members").doc(memberId);
  const teamsCol = clubRef.collection("teams");
  const invitationsCol = clubRef.collection("invitations");

  const guardianDocs = (
    await memberRef.collection("guardians").get()
  ).docs;

  let removedDisplayName = "";
  let didRemove = false;

  await db().runTransaction(async (tx) => {
    // --- Lectures (toutes avant la première écriture) ---
    const [memberSnap, clubSnap, adminMembers] = await Promise.all([
      tx.get(memberRef),
      tx.get(clubRef),
      loadAdminMembers(tx, clubId),
    ]);
    if (!memberSnap.exists) {
      // Idempotent : déjà retiré.
      return;
    }
    if (!clubSnap.exists) {
      throw new HttpsError("not-found", "Club introuvable");
    }

    const member = memberSnap.data()!;
    const role = String(member.role ?? ROLE_PLAYER);
    const accountUid = accountUidOf(member);
    const adminIds = stringArray(clubSnap.data()?.adminIds);
    const target: AdminMemberRef = { memberId, accountUid };
    const firstName = String(member.firstName ?? "").trim();
    const lastName = String(member.lastName ?? "").trim();
    const snapshot =
      member.snapshot && typeof member.snapshot === "object"
        ? (member.snapshot as Record<string, unknown>)
        : {};
    removedDisplayName =
      [firstName, lastName].filter(Boolean).join(" ") ||
      String(snapshot.displayName ?? "").trim() ||
      memberId;
    didRemove = true;

    if (role === ROLE_ADMIN && isLastAdmin({ adminIds, adminMembers, target })) {
      throw new HttpsError(
        "failed-precondition",
        "Impossible de retirer le dernier administrateur",
      );
    }

    const rosterIds = uniq([memberId, ...(accountUid ? [accountUid] : [])]);
    const rosterSnaps = await Promise.all(
      TEAM_ROSTER_FIELDS.flatMap((field) =>
        rosterIds.map((id) =>
          tx.get(teamsCol.where(field, "array-contains", id) as Query),
        ),
      ),
    );

    const activeInvitationId = String(member.activeInvitationId ?? "").trim();
    const [activeInviteSnap, pendingByMemberSnap] = await Promise.all([
      activeInvitationId
        ? tx.get(invitationsCol.doc(activeInvitationId))
        : Promise.resolve(null),
      tx.get(
        invitationsCol
          .where("memberId", "==", memberId)
          .where("status", "==", INVITATION_STATUS_PENDING) as Query,
      ),
    ]);

    const userRef = accountUid ? db().collection("users").doc(accountUid) : null;
    const accountIndexRef = accountUid
      ? clubRef.collection("member_accounts").doc(accountUid)
      : null;
    const [userSnap, accountIndexSnap] = await Promise.all([
      userRef ? tx.get(userRef) : Promise.resolve(null),
      accountIndexRef ? tx.get(accountIndexRef) : Promise.resolve(null),
    ]);

    // --- Écritures ---
    tx.delete(memberRef);

    const clubPatch: Record<string, unknown> = {
      memberCount: decrementCount(clubSnap.data()?.memberCount),
      updatedAt: serverTimestamp(),
    };
    const remainingAdminIds = adminIdsWithout(adminIds, target);
    if (remainingAdminIds.length !== adminIds.length) {
      clubPatch.adminIds = remainingAdminIds;
    }
    tx.update(clubRef, clubPatch);

    // Rosters : un patch fusionné par équipe, tous champs concernés.
    const teamPatches = new Map<DocumentReference, Record<string, unknown>>();
    for (const snap of rosterSnaps) {
      for (const teamDoc of snap.docs) {
        const patch = teamPatches.get(teamDoc.ref) ?? {};
        const data = teamDoc.data();
        for (const field of TEAM_ROSTER_FIELDS) {
          const ids = stringArray(data[field]);
          const next = ids.filter((id) => !rosterIds.includes(id));
          if (next.length !== ids.length) patch[field] = next;
        }
        if (Object.keys(patch).length > 0) teamPatches.set(teamDoc.ref, patch);
      }
    }
    for (const [ref, patch] of teamPatches) {
      tx.update(ref, { ...patch, updatedAt: serverTimestamp() });
    }

    // Invitations pending liées → revoked (par id actif et par memberId).
    const inviteRefs = new Map<string, DocumentReference>();
    if (
      activeInviteSnap?.exists &&
      String(activeInviteSnap.data()?.status ?? "") === INVITATION_STATUS_PENDING
    ) {
      inviteRefs.set(activeInviteSnap.ref.path, activeInviteSnap.ref);
    }
    for (const inviteDoc of pendingByMemberSnap.docs) {
      inviteRefs.set(inviteDoc.ref.path, inviteDoc.ref);
    }
    for (const ref of inviteRefs.values()) {
      tx.update(ref, {
        status: INVITATION_STATUS_REVOKED,
        updatedAt: serverTimestamp(),
      });
    }

    if (userRef && userSnap?.exists) {
      tx.update(userRef, {
        clubMemberships: withoutMembership(userSnap.data()?.clubMemberships, clubId),
        updatedAt: serverTimestamp(),
      });
    }
    if (accountIndexRef && accountIndexSnap?.exists) {
      tx.delete(accountIndexRef);
    }
  });

  // Hors transaction : sous-collection guardians orpheline + parentTeamIds.
  if (guardianDocs.length > 0) {
    await detachGuardiansOfMember(clubId, memberId, guardianDocs);
  }

  if (didRemove) {
    await logClubActivity({
      clubId,
      type: ClubActivityTypes.membersRemoved,
      actorUid: callerUid,
      count: 1,
      summary: removedDisplayName,
      entityIds: [memberId],
    });
  }

  return { ok: true };
}

export const {
  prod: setMemberRole,
  dev: setMemberRoleDev,
} = defineDualCallable(handleSetMemberRole);

export const {
  prod: removeMember,
  dev: removeMemberDev,
} = defineDualCallable(handleRemoveMember);

export const {
  prod: resolveJoinRequest,
  dev: resolveJoinRequestDev,
} = defineDualCallable(handleResolveJoinRequest);
