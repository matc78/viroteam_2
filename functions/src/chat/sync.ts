import * as admin from "firebase-admin";
import * as crypto from "crypto";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { stringArray, uniq } from "../common";
import { activeGuardianUids } from "../parentTeams";

const WRITE_OPEN = "open";
const WRITE_ADMINS = "admins_only";

type UpsertConversationParams = {
  firestore: Firestore;
  clubId: string;
  systemKey: string;
  type: string;
  title: string;
  participantUids: string[];
  writePolicy: string;
  teamId?: string;
  categoryKey?: string;
};

/** Id déterministe pour rendre les créations concurrentes idempotentes. */
function stableConversationId(systemKey: string): string {
  return crypto.createHash("sha256").update(systemKey).digest("hex").slice(0, 28);
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === 6 || code === "already-exists";
}

/**
 * Upsert idempotent d’une conversation système via `systemKey`.
 * Retourne l’id du document.
 */
export async function upsertSystemConversation(
  params: UpsertConversationParams,
): Promise<string> {
  const col = params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("conversations");

  const existing = await col
    .where("systemKey", "==", params.systemKey)
    .limit(1)
    .get();

  const payload: Record<string, unknown> = {
    type: params.type,
    systemKey: params.systemKey,
    title: params.title,
    participantUids: uniq(params.participantUids.filter(Boolean)),
    writePolicy: params.writePolicy,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (params.teamId) payload.teamId = params.teamId;
  if (params.categoryKey) payload.categoryKey = params.categoryKey;

  if (!existing.empty) {
    const ref = existing.docs[0]!.ref;
    await ref.set(payload, { merge: true });
    return ref.id;
  }

  // Id stable : deux créations concurrentes (même systemKey) convergent.
  const ref = col.doc(stableConversationId(params.systemKey));
  try {
    await ref.create({
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessagePreview: "",
    });
  } catch (error) {
    if (!isAlreadyExistsError(error)) throw error;
    await ref.set(payload, { merge: true });
  }
  return ref.id;
}

/** Résout un id roster → Auth uid (accountUid / userId). */
export async function resolveAuthUid(
  firestore: Firestore,
  clubId: string,
  rosterId: string,
): Promise<string | null> {
  const clubRef = firestore.collection("clubs").doc(clubId);
  const direct = await clubRef.collection("members").doc(rosterId).get();
  if (direct.exists) {
    return authUidFromMember(rosterId, direct.data() ?? {});
  }

  const account = await clubRef.collection("member_accounts").doc(rosterId).get();
  if (account.exists) {
    // rosterId est déjà un accountUid
    return rosterId;
  }

  const byAccount = await clubRef
    .collection("members")
    .where("accountUid", "==", rosterId)
    .limit(1)
    .get();
  if (!byAccount.empty) return rosterId;

  return null;
}

function authUidFromMember(memberId: string, data: DocumentData): string | null {
  const accountUid = String(data.accountUid ?? "").trim();
  if (accountUid) return accountUid;
  const userId = String(data.userId ?? "").trim();
  if (userId) return userId;
  // Fiche pré-créée sans compte : pas de participant pushable.
  if (memberId && data.accountUid == null && data.userId == null) return null;
  return null;
}

/** Uids Auth pour une liste d’ids roster. */
export async function resolveAuthUids(
  firestore: Firestore,
  clubId: string,
  rosterIds: string[],
): Promise<string[]> {
  const uids: string[] = [];
  for (const rosterId of uniq(rosterIds)) {
    const uid = await resolveAuthUid(firestore, clubId, rosterId);
    if (uid) uids.push(uid);
  }
  return uniq(uids);
}

/**
 * Sync conversations `team` + `parents` pour une équipe.
 */
export async function syncTeamConversations(params: {
  firestore: Firestore;
  clubId: string;
  teamId: string;
  teamData: DocumentData | undefined;
}): Promise<void> {
  const { firestore, clubId, teamId, teamData } = params;
  if (!teamData) {
    // Équipe supprimée : on retire les participants en vidant (docs conservés).
    await clearSystemConversationParticipants(firestore, clubId, `team:${teamId}`);
    await clearSystemConversationParticipants(
      firestore,
      clubId,
      `parents:${teamId}`,
    );
    return;
  }

  const teamName = String(teamData.name ?? "Équipe").trim() || "Équipe";
  const playerIds = stringArray(teamData.playerIds);
  const coachIds = stringArray(teamData.coachIds);

  const playerUids = await resolveAuthUids(firestore, clubId, playerIds);
  const coachUids = await resolveAuthUids(firestore, clubId, coachIds);

  await upsertSystemConversation({
    firestore,
    clubId,
    systemKey: `team:${teamId}`,
    type: "team",
    title: teamName,
    teamId,
    participantUids: uniq([...playerUids, ...coachUids]),
    writePolicy: WRITE_OPEN,
  });

  const parentUids: string[] = [];
  for (const rosterId of playerIds) {
    const memberId = await resolveMemberIdForChat(firestore, clubId, rosterId);
    if (!memberId) continue;
    parentUids.push(
      ...(await activeGuardianUids(firestore, clubId, memberId)),
    );
  }

  await upsertSystemConversation({
    firestore,
    clubId,
    systemKey: `parents:${teamId}`,
    type: "parents",
    title: `Parents · ${teamName}`,
    teamId,
    participantUids: uniq([...parentUids, ...coachUids]),
    writePolicy: WRITE_OPEN,
  });
}

async function clearSystemConversationParticipants(
  firestore: Firestore,
  clubId: string,
  systemKey: string,
): Promise<void> {
  const snap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("conversations")
    .where("systemKey", "==", systemKey)
    .limit(1)
    .get();
  if (snap.empty) return;
  await snap.docs[0]!.ref.set(
    {
      participantUids: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function resolveMemberIdForChat(
  firestore: Firestore,
  clubId: string,
  rosterId: string,
): Promise<string | null> {
  const clubRef = firestore.collection("clubs").doc(clubId);
  const direct = await clubRef.collection("members").doc(rosterId).get();
  if (direct.exists) return rosterId;
  const account = await clubRef.collection("member_accounts").doc(rosterId).get();
  const linked = String(account.data()?.memberId ?? "").trim();
  if (account.exists && linked) return linked;
  const byAccount = await clubRef
    .collection("members")
    .where("accountUid", "==", rosterId)
    .limit(1)
    .get();
  return byAccount.docs[0]?.id ?? null;
}

/**
 * Sync `staff` (coachs + admins) et `club` (tous les licenciés, écriture admin).
 */
export async function syncClubWideConversations(params: {
  firestore: Firestore;
  clubId: string;
}): Promise<void> {
  const { firestore, clubId } = params;
  const clubSnap = await firestore.collection("clubs").doc(clubId).get();
  const clubName = String(clubSnap.data()?.name ?? "Club").trim() || "Club";
  const adminIds = stringArray(clubSnap.data()?.adminIds);

  const membersSnap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .get();

  const licensedUids: string[] = [];
  const staffUids: string[] = [...adminIds];

  for (const doc of membersSnap.docs) {
    const data = doc.data();
    if (String(data.status ?? "") === "archived") continue;
    const uid = authUidFromMember(doc.id, data);
    if (!uid) continue;
    licensedUids.push(uid);
    const role = String(data.role ?? "");
    if (role === "admin" || role === "coach") {
      staffUids.push(uid);
    }
  }

  await upsertSystemConversation({
    firestore,
    clubId,
    systemKey: "staff",
    type: "staff",
    title: "Staff",
    participantUids: uniq(staffUids),
    writePolicy: WRITE_OPEN,
  });

  await upsertSystemConversation({
    firestore,
    clubId,
    systemKey: "club",
    type: "club",
    title: clubName,
    participantUids: uniq(licensedUids),
    writePolicy: WRITE_ADMINS,
  });
}

/**
 * Backfill idempotent : toutes les équipes + staff + club.
 * Pour clubs déjà initialisés avant le déploiement du chat.
 */
export async function syncAllConversationsForClub(params: {
  firestore: Firestore;
  clubId: string;
}): Promise<{ teamsSynced: number }> {
  const { firestore, clubId } = params;
  const teamsSnap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("teams")
    .get();

  for (const teamDoc of teamsSnap.docs) {
    await syncTeamConversations({
      firestore,
      clubId,
      teamId: teamDoc.id,
      teamData: teamDoc.data(),
    });
  }

  await syncClubWideConversations({ firestore, clubId });
  return { teamsSynced: teamsSnap.size };
}

/**
 * Crée un canal catégorie (admins only write) et retourne son id.
 */
export async function createCategoryConversation(params: {
  firestore: Firestore;
  clubId: string;
  categoryKey: string;
  title: string;
  participantUids: string[];
  writePolicy?: string;
}): Promise<string> {
  return upsertSystemConversation({
    firestore: params.firestore,
    clubId: params.clubId,
    systemKey: `category:${params.categoryKey}`,
    type: "category",
    title: params.title,
    categoryKey: params.categoryKey,
    participantUids: params.participantUids,
    writePolicy: params.writePolicy ?? WRITE_ADMINS,
  });
}
