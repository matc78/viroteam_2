import * as admin from "firebase-admin";
import type { DocumentReference, Query } from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db, defineDualCallable } from "./db";
import {
  TEAM_ROSTER_FIELDS,
  parseParentLinks,
  requireUid,
  stringArray,
  uniq,
} from "./common";
import {
  decrementCount,
  accountUidOf,
  parseRemoveMemberArgs,
  parseSetMemberPermissionsArgs,
} from "./memberAdminUtils";
import {
  assertPermission,
  loadClubAccess,
  permissionDenied,
  writeMemberPermissions,
} from "./permissions";
import {
  adminIdsUpdate,
  grantsAdmin,
  isLastAdmin,
  PERMISSION_ADMIN,
} from "./permissionsCatalog";
import { recomputeParentTeamIdsSafe } from "./parentTeams";
import { ClubActivityTypes, logClubActivity } from "./clubActivity";

const INVITATION_STATUS_PENDING = "pending";
const INVITATION_STATUS_REVOKED = "revoked";

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

const LAST_ADMIN_MESSAGE = "Impossible de retirer le dernier administrateur";
/** `details.reason` de l'erreur « dernier admin » (lue par l'app et le portail). */
const LAST_ADMIN_REASON = "last-admin";

/**
 * Remplace les droits d'un membre. Appelant : droit Administrateur.
 * Les modèles (admin / coach / joueur) et les fonctions sont des raccourcis
 * côté client : la callable ne reçoit que la liste de droits voulue.
 * Gardes : pas d'auto-modification ; « dernier admin ».
 * Effets : `members/{memberId}.permissions` et l'index `club.adminIds`.
 * Fonctionne sur une fiche non liée (les droits suivent le re-keying).
 * Prod → v2-prod ; `setMemberPermissionsDev` → v2-dev.
 */
async function handleSetMemberPermissions(
  request: CallableRequest,
): Promise<{ ok: true; permissions: string[] }> {
  const callerUid = requireUid(request);
  const { clubId, memberId, permissions } = parseSetMemberPermissionsArgs(
    request.data,
  );
  await assertPermission(clubId, callerUid, PERMISSION_ADMIN);

  // Une seule clé membre : la fiche de l'appelant est members/{callerUid}.
  if (memberId === callerUid) {
    throw new HttpsError(
      "failed-precondition",
      "Tu ne peux pas modifier tes propres droits — un autre admin doit le faire.",
    );
  }

  const clubRef = db().collection("clubs").doc(clubId);
  const memberRef = clubRef.collection("members").doc(memberId);

  const stored = await db().runTransaction(async (tx) => {
    const [memberSnap, clubSnap] = await Promise.all([
      tx.get(memberRef),
      tx.get(clubRef),
    ]);
    if (!memberSnap.exists) {
      throw new HttpsError("not-found", "Membre introuvable");
    }
    if (!clubSnap.exists) {
      throw new HttpsError("not-found", "Club introuvable");
    }
    const member = memberSnap.data()!;
    const club = clubSnap.data()!;

    if (
      grantsAdmin(member.permissions) &&
      !grantsAdmin(permissions) &&
      isLastAdmin({ adminIds: stringArray(club.adminIds), memberId })
    ) {
      throw new HttpsError("failed-precondition", LAST_ADMIN_MESSAGE, {
        reason: LAST_ADMIN_REASON,
      });
    }

    return writeMemberPermissions(tx, {
      clubRef,
      club,
      memberRef,
      member,
      permissions,
    });
  });

  return { ok: true, permissions: stored };
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
          const nextLinks = parseParentLinks(userSnap.data()?.parentLinks).filter(
            (link) => !(link.clubId === clubId && link.memberId === memberId),
          );
          const parentClubIds = uniq(
            nextLinks
              .filter((link) => link.status === "active")
              .map((link) => link.clubId),
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
 * Retire un membre du club. Appelant : droit `manageMembers` (droit
 * Administrateur si la cible est admin). Garde « dernier admin ».
 * Effets : suppression `members/{memberId}`,
 * `club.adminIds`/`memberCount`, rosters `teams`, invitation pending → revoked,
 * `users/{accountUid}.memberClubIds` sans le club, guardians détachés.
 * Prod → v2-prod ; `removeMemberDev` → v2-dev.
 */
async function handleRemoveMember(
  request: CallableRequest,
): Promise<{ ok: true }> {
  const callerUid = requireUid(request);
  const { clubId, memberId } = parseRemoveMemberArgs(request.data);
  const access = await loadClubAccess(clubId, callerUid);
  if (!access.can("manageMembers")) throw permissionDenied();

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
    const [memberSnap, clubSnap] = await Promise.all([
      tx.get(memberRef),
      tx.get(clubRef),
    ]);
    if (!memberSnap.exists) {
      // Idempotent : déjà retiré.
      return;
    }
    if (!clubSnap.exists) {
      throw new HttpsError("not-found", "Club introuvable");
    }

    const member = memberSnap.data()!;
    const targetIsAdmin = grantsAdmin(member.permissions);
    const accountUid = accountUidOf(member);
    const adminIds = stringArray(clubSnap.data()?.adminIds);
    if (targetIsAdmin && !access.isAdmin) {
      throw permissionDenied("Seul un admin peut retirer un admin");
    }
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

    if (targetIsAdmin && isLastAdmin({ adminIds, memberId })) {
      throw new HttpsError("failed-precondition", LAST_ADMIN_MESSAGE, {
        reason: LAST_ADMIN_REASON,
      });
    }

    const rosterSnaps = await Promise.all(
      TEAM_ROSTER_FIELDS.map((field) =>
        tx.get(teamsCol.where(field, "array-contains", memberId) as Query),
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
    const userSnap = userRef ? await tx.get(userRef) : null;

    // --- Écritures ---
    tx.delete(memberRef);

    const clubPatch: Record<string, unknown> = {
      memberCount: decrementCount(clubSnap.data()?.memberCount),
      updatedAt: serverTimestamp(),
    };
    const nextAdminIds = adminIdsUpdate({
      adminIds,
      memberId,
      linked: false,
      permissions: [],
    });
    if (nextAdminIds) clubPatch.adminIds = nextAdminIds;
    tx.update(clubRef, clubPatch);

    // Rosters : un patch fusionné par équipe, tous champs concernés.
    const teamPatches = new Map<
      string,
      { ref: DocumentReference; patch: Record<string, unknown> }
    >();
    for (const snap of rosterSnaps) {
      for (const teamDoc of snap.docs) {
        const patch = teamPatches.get(teamDoc.ref.path)?.patch ?? {};
        const data = teamDoc.data();
        for (const field of TEAM_ROSTER_FIELDS) {
          const ids = stringArray(data[field]);
          const next = ids.filter((id) => id !== memberId);
          if (next.length !== ids.length) patch[field] = next;
        }
        if (Object.keys(patch).length > 0) {
          teamPatches.set(teamDoc.ref.path, { ref: teamDoc.ref as DocumentReference, patch });
        }
      }
    }
    for (const { ref, patch } of teamPatches.values()) {
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
        memberClubIds: admin.firestore.FieldValue.arrayRemove(clubId),
        updatedAt: serverTimestamp(),
      });
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
  prod: setMemberPermissions,
  dev: setMemberPermissionsDev,
} = defineDualCallable(handleSetMemberPermissions);

export const {
  prod: removeMember,
  dev: removeMemberDev,
} = defineDualCallable(handleRemoveMember);

