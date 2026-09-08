import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { stringArray, uniq } from "../common";

const GUARDIAN_STATUS_ACTIVE = "active";

const TARGET_ALL = "Tous les membres";
const TARGET_ALL_LEGACY = "all";
const TARGET_TEAMS = "Équipes";
const TARGET_CATEGORIES = "Catégories";
const TARGET_PERSONNES = "Personnes";

/**
 * UID Auth d'une fiche membre (accountUid / userId / memberId).
 */
export function memberAccountUid(
  memberData: DocumentData,
  memberId: string,
): string | null {
  const accountUid = String(memberData.accountUid ?? "").trim();
  if (accountUid) return accountUid;
  const userId = String(memberData.userId ?? "").trim();
  if (userId) return userId;
  const fallback = memberId.trim();
  return fallback.length > 0 ? fallback : null;
}

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
 * Destinataires d'un event : joueurs (`teamMemberIds`) + coaches des `teamIds`
 * + guardians actifs des joueurs.
 */
export async function resolveEventRecipientUids(params: {
  firestore: Firestore;
  clubId: string;
  teamIds: string[];
  teamMemberIds: string[];
  extraUids?: string[];
}): Promise<string[]> {
  const { firestore, clubId } = params;
  const uids = new Set<string>();

  for (const extra of params.extraUids ?? []) {
    if (extra.trim()) uids.add(extra.trim());
  }

  const teamIds = uniq(params.teamIds.map(String).filter(Boolean));
  const teamMemberIds = uniq(params.teamMemberIds.map(String).filter(Boolean));

  for (const teamId of teamIds) {
    const teamSnap = await firestore
      .collection("clubs")
      .doc(clubId)
      .collection("teams")
      .doc(teamId)
      .get();
    if (!teamSnap.exists) continue;
    for (const coachId of stringArray(teamSnap.data()?.coachIds)) {
      uids.add(coachId);
    }
  }

  for (const memberId of teamMemberIds) {
    const memberSnap = await firestore
      .collection("clubs")
      .doc(clubId)
      .collection("members")
      .doc(memberId)
      .get();
    if (memberSnap.exists) {
      const accountUid = memberAccountUid(memberSnap.data()!, memberId);
      if (accountUid) uids.add(accountUid);
    } else {
      // Souvent teamMemberIds contient déjà l'uid Auth.
      uids.add(memberId);
    }
    for (const guardianUid of await activeGuardianUids(
      firestore,
      clubId,
      memberId,
    )) {
      uids.add(guardianUid);
    }
  }

  return [...uids];
}

/**
 * Destinataires d'une annonce selon targetType + senderId.
 */
export async function resolveAnnouncementRecipientUids(params: {
  firestore: Firestore;
  clubId: string;
  targetType: string;
  targetIds: string[];
  senderId: string;
}): Promise<string[]> {
  const { firestore, clubId, targetType } = params;
  const targetIds = uniq(params.targetIds.map(String).filter(Boolean));
  const uids = new Set<string>();
  if (params.senderId.trim()) uids.add(params.senderId.trim());

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
      for (const coachId of stringArray(data.coachIds)) uids.add(coachId);
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
      for (const coachId of stringArray(data.coachIds)) uids.add(coachId);
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

async function addMemberAndGuardians(
  firestore: Firestore,
  clubId: string,
  memberOrRosterId: string,
  uids: Set<string>,
): Promise<void> {
  const memberId = await resolveMemberId(firestore, clubId, memberOrRosterId);
  const resolvedId = memberId ?? memberOrRosterId;

  const memberSnap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(resolvedId)
    .get();
  if (memberSnap.exists) {
    const accountUid = memberAccountUid(memberSnap.data()!, resolvedId);
    if (accountUid) uids.add(accountUid);
  } else {
    uids.add(memberOrRosterId);
  }

  for (const guardianUid of await activeGuardianUids(
    firestore,
    clubId,
    resolvedId,
  )) {
    uids.add(guardianUid);
  }
}

async function resolveMemberId(
  firestore: Firestore,
  clubId: string,
  rosterId: string,
): Promise<string | null> {
  const direct = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(rosterId)
    .get();
  if (direct.exists) return direct.id;

  const account = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("member_accounts")
    .doc(rosterId)
    .get();
  if (account.exists) {
    const memberId = String(account.data()?.memberId ?? "").trim();
    return memberId || null;
  }
  return null;
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
    const uid = memberAccountUid(doc.data(), doc.id);
    if (uid) uids.push(uid);
  }
  return uniq(uids);
}

async function allActiveGuardianUidsInClub(
  firestore: Firestore,
  clubId: string,
): Promise<string[]> {
  const snap = await firestore
    .collectionGroup("guardians")
    .where("status", "==", GUARDIAN_STATUS_ACTIVE)
    .get();
  const uids: string[] = [];
  for (const doc of snap.docs) {
    const memberRef = doc.ref.parent.parent;
    if (!memberRef) continue;
    const clubRef = memberRef.parent.parent;
    if (!clubRef || clubRef.id !== clubId) continue;
    const parentUid = String(doc.data().parentUid ?? doc.id).trim();
    if (parentUid) uids.push(parentUid);
  }
  return uniq(uids);
}
