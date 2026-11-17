import * as admin from "firebase-admin";
import type { CallableRequest } from "firebase-functions/v2/https";
import { authEmailOf, requireUid } from "./common";
import { parseCreateClubArgs } from "./createClubUtils";
import { db, defineDualCallable } from "./db";
import { PERMISSION_ADMIN } from "./permissionsCatalog";

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

/**
 * Crée un club et la fiche de son fondateur. Les droits ne s'écrivent que
 * côté serveur : le fondateur reçoit le droit Administrateur (`permissions:
 * ['admin']`) et entre dans l'index `adminIds`.
 * Effets : `clubs/{clubId}`, `members/{uid}` (une seule clé membre),
 * `users/{uid}.memberClubIds`.
 * Prod → v2-prod ; `createClubDev` → v2-dev.
 */
async function handleCreateClub(
  request: CallableRequest,
): Promise<{ ok: true; clubId: string }> {
  const uid = requireUid(request);
  const draft = parseCreateClubArgs(request.data);

  const clubRef = db().collection("clubs").doc();
  const memberRef = clubRef.collection("members").doc(uid);
  const userRef = db().collection("users").doc(uid);

  await db().runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const user = (userSnap.data() ?? {}) as Record<string, unknown>;
    const firstName = String(user.firstName ?? "").trim();
    const lastName = String(user.lastName ?? "").trim();
    const email = String(user.email ?? "").trim() || authEmailOf(request);
    const displayName =
      String(user.displayName ?? "").trim() ||
      `${firstName} ${lastName}`.trim() ||
      email;
    const avatarUrl = typeof user.avatarUrl === "string" ? user.avatarUrl : "";

    tx.set(clubRef, {
      name: draft.name,
      sport: draft.sport,
      city: draft.city,
      postalCode: draft.postalCode,
      address: draft.address,
      ...(draft.description ? { description: draft.description } : {}),
      brandColorHex: draft.brandColorHex,
      practiceLocations: draft.practiceLocations,
      adminIds: [uid],
      memberCount: 1,
      seasonEndDate: admin.firestore.Timestamp.fromMillis(draft.seasonEndDateMs),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.set(memberRef, {
      accountUid: uid,
      firstName,
      lastName,
      permissions: [PERMISSION_ADMIN],
      coachTeamIds: [],
      status: "active",
      teamIds: [],
      snapshot: {
        displayName,
        email,
        ...(avatarUrl ? { avatarUrl } : {}),
      },
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.set(
      userRef,
      {
        memberClubIds: admin.firestore.FieldValue.arrayUnion(clubRef.id),
        flags: { profileCompleted: true, disabled: false },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { ok: true, clubId: clubRef.id };
}

export const {
  prod: createClub,
  dev: createClubDev,
} = defineDualCallable(handleCreateClub);
