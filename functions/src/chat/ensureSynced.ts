import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { requireString, requireUid, stringArray } from "../common";
import { db, defineDualCallable } from "../db";
import { syncAllConversationsForClub } from "./sync";

/**
 * Crée / met à jour les conversations système d’un club (équipes existantes,
 * staff, club). Idempotent — à appeler après déploiement chat ou à l’ouverture
 * de l’inbox.
 *
 * Args : `{ clubId: string }`
 * Auth : membre licencié ou parent du club.
 */
async function handleEnsureClubChatSynced(request: CallableRequest): Promise<{
  teamsSynced: number;
}> {
  const uid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const firestore = db();

  const clubRef = firestore.collection("clubs").doc(clubId);
  const clubSnap = await clubRef.get();
  if (!clubSnap.exists) {
    throw new HttpsError("not-found", "Club introuvable");
  }

  const account = await clubRef.collection("member_accounts").doc(uid).get();
  const directMember = await clubRef.collection("members").doc(uid).get();
  const userSnap = await firestore.collection("users").doc(uid).get();
  const parentClubIds = stringArray(userSnap.data()?.parentClubIds);
  const isMember = account.exists || directMember.exists;
  const isParent = parentClubIds.includes(clubId);
  const isAdmin = stringArray(clubSnap.data()?.adminIds).includes(uid);

  if (!isMember && !isParent && !isAdmin) {
    throw new HttpsError("permission-denied", "Tu n’es pas dans ce club");
  }

  return syncAllConversationsForClub({ firestore, clubId });
}

/**
 * Backfill de tous les clubs (ops après déploiement).
 * Réservé aux comptes présents dans `adminIds` d’au moins un club — traite
 * uniquement les clubs où l’appelant est admin.
 */
async function handleBackfillMyAdminClubChats(
  request: CallableRequest,
): Promise<{ clubsSynced: number; teamsSynced: number }> {
  const uid = requireUid(request);
  const firestore = db();

  const clubsSnap = await firestore
    .collection("clubs")
    .where("adminIds", "array-contains", uid)
    .get();

  let teamsSynced = 0;
  for (const clubDoc of clubsSnap.docs) {
    const result = await syncAllConversationsForClub({
      firestore,
      clubId: clubDoc.id,
    });
    teamsSynced += result.teamsSynced;
  }

  return { clubsSynced: clubsSnap.size, teamsSynced };
}

export const { prod: ensureClubChatSynced, dev: ensureClubChatSyncedDev } =
  defineDualCallable(handleEnsureClubChatSynced);

export const {
  prod: backfillMyAdminClubChats,
  dev: backfillMyAdminClubChatsDev,
} = defineDualCallable(handleBackfillMyAdminClubChats);
