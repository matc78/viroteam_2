import * as admin from "firebase-admin";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { requireString, requireUid } from "../common";
import { db, defineDualCallable } from "../db";
import { assertClubAdmin } from "../guardians";
import { syncAllConversationsForClub, syncScopedChannels } from "./sync";

/**
 * Délai minimal entre deux resync complètes d'un même club : la resync relit
 * équipes, rosters et guardians, elle ne doit pas servir de chemin courant.
 */
const CLUB_CHAT_RESYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Resync complète d'un club (conversations d'équipes, staff, club, canaux
 * ciblés), throttlée par `clubs/{clubId}.chatSyncedAt`. Retourne
 * `{ teamsSynced, skipped }` (`skipped` = resync récente, rien fait).
 */
async function resyncClubChat(clubId: string): Promise<{
  teamsSynced: number;
  skipped: boolean;
}> {
  const firestore = db();
  const clubRef = firestore.collection("clubs").doc(clubId);
  const clubSnap = await clubRef.get();
  if (!clubSnap.exists) {
    throw new HttpsError("not-found", "Club introuvable");
  }
  const lastSyncMs = clubSnap.data()?.chatSyncedAt?.toMillis?.() ?? 0;
  if (Date.now() - lastSyncMs < CLUB_CHAT_RESYNC_MIN_INTERVAL_MS) {
    return { teamsSynced: 0, skipped: true };
  }
  await clubRef.update({ chatSyncedAt: admin.firestore.FieldValue.serverTimestamp() });
  const { teamsSynced } = await syncAllConversationsForClub({ firestore, clubId });
  await syncScopedChannels({ firestore, clubId });
  return { teamsSynced, skipped: false };
}

/**
 * Réparation : recrée / resynchronise les conversations d'un club. Les
 * triggers (équipes, fiches, guardians, adminIds) restent la source normale ;
 * ce n'est plus appelé à l'ouverture de l'inbox.
 *
 * Args : `{ clubId: string }`
 * Auth : admin du club.
 */
async function handleEnsureClubChatSynced(request: CallableRequest): Promise<{
  teamsSynced: number;
  skipped: boolean;
}> {
  const uid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  await assertClubAdmin(clubId, uid);
  return resyncClubChat(clubId);
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

  let clubsSynced = 0;
  let teamsSynced = 0;
  for (const clubDoc of clubsSnap.docs) {
    const result = await resyncClubChat(clubDoc.id);
    if (result.skipped) continue;
    clubsSynced += 1;
    teamsSynced += result.teamsSynced;
  }

  return { clubsSynced, teamsSynced };
}

export const { prod: ensureClubChatSynced, dev: ensureClubChatSyncedDev } =
  defineDualCallable(handleEnsureClubChatSynced);

export const {
  prod: backfillMyAdminClubChats,
  dev: backfillMyAdminClubChatsDev,
} = defineDualCallable(handleBackfillMyAdminClubChats);
