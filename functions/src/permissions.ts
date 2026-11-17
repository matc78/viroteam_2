import * as admin from "firebase-admin";
import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "./db";
import { accountUidOf, stringArray } from "./common";
import {
  adminIdsUpdate,
  buildClubAccess,
  normalizePermissions,
  type ClubAccess,
  type ClubPermission,
  type CoachFlag,
} from "./permissionsCatalog";

/**
 * Point d'entrée unique du contrôle d'accès côté Functions.
 *
 * Seule la liste `members/{uid}.permissions` fait foi (droit `admin` =
 * tous les droits). Être coach d'une équipe est une relation
 * (`members.coachTeamIds`, dérivé de `teams.coachIds`) qui donne des
 * capacités sur ses équipes, réglées par `clubs.coachPermissions`.
 * `clubs.adminIds` n'est qu'un index d'audience, jamais une autorisation.
 */

const DENIED_MESSAGE = "Tu n'as pas les droits pour cette action";

/** Erreur `permission-denied` uniforme. */
export function permissionDenied(message = DENIED_MESSAGE): HttpsError {
  return new HttpsError("permission-denied", message);
}

/**
 * Charge les droits effectifs de `uid` dans `clubId` (club + fiche
 * `members/{uid}`), dans `tx` si fourni. `not-found` si le club n'existe pas.
 */
export async function loadClubAccess(
  clubId: string,
  uid: string,
  tx?: Transaction,
): Promise<ClubAccess> {
  const clubRef = db().collection("clubs").doc(clubId);
  const memberRef = clubRef.collection("members").doc(uid);
  const [clubSnap, memberSnap] = tx
    ? await Promise.all([tx.get(clubRef), tx.get(memberRef)])
    : await Promise.all([clubRef.get(), memberRef.get()]);
  if (!clubSnap.exists) {
    throw new HttpsError("not-found", "Club introuvable");
  }
  return buildClubAccess({
    clubId,
    uid,
    club: clubSnap.data() ?? {},
    member: memberSnap.exists ? (memberSnap.data() ?? {}) : null,
  });
}

/** Exige le droit `permission` dans le club. Retourne les droits effectifs. */
export async function assertPermission(
  clubId: string,
  uid: string,
  permission: ClubPermission,
  message?: string,
): Promise<ClubAccess> {
  const access = await loadClubAccess(clubId, uid);
  if (!access.can(permission)) throw permissionDenied(message);
  return access;
}

/**
 * Exige le droit `permission`, ou d'être coach d'au moins une des `teamIds`
 * (et, si `coachFlag` est fourni, que le club active cette capacité coach).
 */
export async function assertPermissionOrTeamCoach(params: {
  clubId: string;
  uid: string;
  permission: ClubPermission;
  teamIds: readonly string[];
  coachFlag?: CoachFlag;
  message?: string;
}): Promise<ClubAccess> {
  const access = await loadClubAccess(params.clubId, params.uid);
  if (access.can(params.permission)) return access;
  const coachAllowed =
    access.coachesAnyTeam(params.teamIds) &&
    (params.coachFlag === undefined || access.coachCan(params.coachFlag));
  if (!coachAllowed) throw permissionDenied(params.message);
  return access;
}

/**
 * Écrit les droits d'une fiche existante (`setMemberPermissions`) et l'index
 * `clubs.adminIds` qui en dépend (via `adminIdsUpdate`, seul calcul de
 * l'index). À appeler après toutes les lectures de `tx`. `permissions` est
 * normalisé.
 */
export function writeMemberPermissions(
  tx: Transaction,
  params: {
    clubRef: DocumentReference;
    club: Record<string, unknown>;
    memberRef: DocumentReference;
    member: Record<string, unknown>;
    permissions: unknown;
  },
): ClubPermission[] {
  const permissions = normalizePermissions(params.permissions);
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  tx.update(params.memberRef, { permissions, updatedAt: timestamp });

  const nextAdminIds = adminIdsUpdate({
    adminIds: stringArray(params.club.adminIds),
    memberId: params.memberRef.id,
    linked: accountUidOf(params.member) !== null,
    permissions,
  });
  if (nextAdminIds) {
    tx.update(params.clubRef, { adminIds: nextAdminIds, updatedAt: timestamp });
  }
  return permissions;
}
