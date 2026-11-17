import type { Firestore } from "firebase-admin/firestore";
import { accountUidOf, stringArray, uniq } from "../common";

const GUARDIAN_STATUS_ACTIVE = "active";

const TARGET_ALL = "Tous les membres";
const TARGET_ALL_LEGACY = "all";
const TARGET_TEAMS = "Équipes";
const TARGET_CATEGORIES = "Catégories";
const TARGET_PERSONNES = "Personnes";

/** Guardians actifs d'une fiche. */
export async function activeGuardianUids(
  firestore: Firestore,
  clubId: string,
  memberId: string,
): Promise<string[]> {
  const snap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(memberId)
    .collection("guardians")
    .where("status", "==", GUARDIAN_STATUS_ACTIVE)
    .get();
  return snap.docs
    .map((doc) => {
      const parentUid = String(doc.data().parentUid ?? doc.id).trim();
      return parentUid;
    })
    .filter((uid) => uid.length > 0);
}

/**
 * Destinataires d'une annonce selon targetType (l'auteur est retiré par l'appelant).
 */
export async function resolveAnnouncementRecipientUids(params: {
  firestore: Firestore;
  clubId: string;
  targetType: string;
  targetIds: string[];
}): Promise<string[]> {
  const { firestore, clubId, targetType } = params;
  const targetIds = uniq(params.targetIds.map(String).filter(Boolean));
  const uids = new Set<string>();

  if (targetType === TARGET_ALL || targetType === TARGET_ALL_LEGACY) {
    for (const uid of await allMemberAccountUids(firestore, clubId)) {
      uids.add(uid);
    }
    for (const uid of await allActiveGuardianUidsInClub(firestore, clubId)) {
      uids.add(uid);
    }
    return [...uids];
  }

  if (targetType === TARGET_PERSONNES) {
    for (const memberId of targetIds) {
      await addMemberAndGuardians(firestore, clubId, memberId, uids);
    }
    return [...uids];
  }

  if (targetType === TARGET_TEAMS) {
    for (const teamId of targetIds) {
      const teamSnap = await firestore
        .collection("clubs")
        .doc(clubId)
        .collection("teams")
        .doc(teamId)
        .get();
      if (!teamSnap.exists) continue;
      const data = teamSnap.data()!;
      for (const coachId of stringArray(data.coachIds)) {
        await addMemberAccount(firestore, clubId, coachId, uids);
      }
      for (const playerId of stringArray(data.playerIds)) {
        await addMemberAndGuardians(firestore, clubId, playerId, uids);
      }
    }
    return [...uids];
  }

  if (targetType === TARGET_CATEGORIES) {
    const teamsSnap = await firestore
      .collection("clubs")
      .doc(clubId)
      .collection("teams")
      .get();
    const categorySet = new Set(targetIds);
    for (const teamDoc of teamsSnap.docs) {
      const data = teamDoc.data();
      const category = String(data.category ?? "").trim();
      if (!categorySet.has(category)) continue;
      for (const coachId of stringArray(data.coachIds)) {
        await addMemberAccount(firestore, clubId, coachId, uids);
      }
      for (const playerId of stringArray(data.playerIds)) {
        await addMemberAndGuardians(firestore, clubId, playerId, uids);
      }
    }
    return [...uids];
  }

  return [...uids];
}

/**
 * Membres d'une saison active dont le statut fee n'est ni payé ni exonéré,
 * plus leurs guardians.
 */
export async function resolveFeeRecipientUids(params: {
  firestore: Firestore;
  clubId: string;
  seasonId: string;
}): Promise<string[]> {
  const { firestore, clubId, seasonId } = params;
  const feesSnap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("fee_seasons")
    .doc(seasonId)
    .collection("member_fees")
    .get();

  const uids = new Set<string>();
  for (const feeDoc of feesSnap.docs) {
    const status = String(feeDoc.data().status ?? "").trim();
    if (status === "paye" || status === "exonere") continue;
    const memberId = feeDoc.id;
    await addMemberAndGuardians(firestore, clubId, memberId, uids);
  }
  return [...uids];
}

/**
 * Ajoute l'uid du compte lié à `members/{memberId}` (ids de roster = ids de
 * fiche). Fiche absente ou non liée : rien (un id de fiche n'est jamais un uid).
 */
async function addMemberAccount(
  firestore: Firestore,
  clubId: string,
  memberId: string,
  uids: Set<string>,
): Promise<void> {
  const memberSnap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(memberId)
    .get();
  const accountUid = accountUidOf(memberSnap.data());
  if (accountUid) uids.add(accountUid);
}

/** Compte lié de la fiche + ses guardians actifs. */
async function addMemberAndGuardians(
  firestore: Firestore,
  clubId: string,
  memberId: string,
  uids: Set<string>,
): Promise<void> {
  await addMemberAccount(firestore, clubId, memberId, uids);
  for (const guardianUid of await activeGuardianUids(firestore, clubId, memberId)) {
    uids.add(guardianUid);
  }
}

async function allMemberAccountUids(
  firestore: Firestore,
  clubId: string,
): Promise<string[]> {
  const snap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .get();
  const uids: string[] = [];
  for (const doc of snap.docs) {
    const status = String(doc.data().status ?? "active").trim();
    if (status === "archived") continue;
    const uid = accountUidOf(doc.data());
    if (uid) uids.push(uid);
  }
  return uniq(uids);
}

/**
 * Guardians actifs du club. `clubId` est dénormalisé sur chaque doc guardian
 * (écrit par `writeGuardianAndParentLinks`) ; index composite
 * `guardians (clubId, status)` en portée COLLECTION_GROUP.
 */
async function allActiveGuardianUidsInClub(
  firestore: Firestore,
  clubId: string,
): Promise<string[]> {
  const snap = await firestore
    .collectionGroup("guardians")
    .where("clubId", "==", clubId)
    .where("status", "==", GUARDIAN_STATUS_ACTIVE)
    .get();
  const uids: string[] = [];
  for (const doc of snap.docs) {
    const parentUid = String(doc.data().parentUid ?? doc.id).trim();
    if (parentUid) uids.push(parentUid);
  }
  return uniq(uids);
}
