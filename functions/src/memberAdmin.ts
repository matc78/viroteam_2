import * as admin from "firebase-admin";
import type {
  DocumentData,
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
  isLastAdmin,
  nextAdminIds,
  parseRemoveMemberArgs,
  parseSetMemberRoleArgs,
  ROLE_ADMIN,
  ROLE_PLAYER,
  withMembershipRole,
  withoutMembership,
  type AdminMemberRef,
} from "./memberAdminUtils";
import { recomputeParentTeamIdsSafe } from "./parentTeams";

export {
  isLastAdmin,
  nextAdminIds,
  parseRemoveMemberArgs,
  parseSetMemberRoleArgs,
} from "./memberAdminUtils";

const INVITATION_STATUS_PENDING = "pending";
const INVITATION_STATUS_REVOKED = "revoked";
const TEAM_ROSTER_FIELDS = ["playerIds", "coachIds", "pendingPlayerIds"] as const;

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

/** `accountUid` (ou `userId` en compat v1) d'une fiche, sinon null. */
function accountUidOf(member: DocumentData): string | null {
  const accountUid = String(member.accountUid ?? member.userId ?? "").trim();
  return accountUid.length > 0 ? accountUid : null;
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

  const clubRef = db().collection("clubs").doc(clubId);
  const memberRef = clubRef.collection("members").doc(memberId);

  await db().runTransaction(async (tx) => {
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
