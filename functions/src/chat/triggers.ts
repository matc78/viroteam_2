import * as admin from "firebase-admin";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { requireString, requireUid, stringArray, uniq } from "../common";
import { db, defineDualCallable, runWithDatabase, type FirestoreDatabaseId } from "../db";
import { assertClubAdmin } from "../guardians";
import { childTeamIds } from "../parentTeams";
import {
  CHANNEL_EXISTS_REASON,
  CHANNEL_WRITE_POLICIES,
  CONVERSATION_TITLE_MAX,
  PRIVATE_CONVERSATION_TYPES,
  memberChatDelta,
  memberChatFieldsChanged,
  type ParticipantDelta,
} from "./memberChatDiff";
import {
  channelScopeSystemKey,
  createScopedChannelConversation,
  findSystemConversation,
  removeUidFromClubConversations,
  resolveScopedChannelParticipants,
  type ChannelAudienceScopeType,
  syncClubWideConversations,
  syncScopedChannels,
  syncTeamConversations,
} from "./sync";

const REGION = "europe-west1";
const FieldValue = admin.firestore.FieldValue;

function defineMemberWrittenTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentWritten(
    {
      document: "clubs/{clubId}/members/{memberId}",
      database: databaseId,
      region: REGION,
    },
    async (event) =>
      runWithDatabase(databaseId, async () => {
        const clubId = event.params.clubId;
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        // Seuls rôle, statut et compte lié comptent pour les chats.
        if (!memberChatFieldsChanged(before, after)) return;
        try {
          await applyMemberChatChange({
            firestore: db(),
            clubId,
            memberId: event.params.memberId,
            before,
            after,
          });
        } catch (error) {
          console.error("applyMemberChatChange failed", { clubId, error });
        }
      }),
  );
}

/** Vrai si [uid] reste parent (guardian actif) dans le club. */
async function isClubGuardian(
  firestore: Firestore,
  clubId: string,
  uid: string,
): Promise<boolean> {
  const userSnap = await firestore.collection("users").doc(uid).get();
  return stringArray(userSnap.data()?.parentClubIds).includes(clubId);
}

/** Vrai si [uid] a encore une fiche membre dans le club. */
async function isClubMemberAccount(
  firestore: Firestore,
  clubId: string,
  uid: string,
): Promise<boolean> {
  const clubRef = firestore.collection("clubs").doc(clubId);
  const [account, direct] = await firestore.getAll(
    clubRef.collection("member_accounts").doc(uid),
    clubRef.collection("members").doc(uid),
  );
  return !!account?.exists || !!direct?.exists;
}

/**
 * Applique une écriture de fiche aux chats `club` / `staff` par ajout /
 * retrait ciblé (plus de relecture de tout le club), puis retire l'uid qui
 * quitte le club de ses DM, groupes coachs et canaux.
 */
async function applyMemberChatChange(params: {
  firestore: Firestore;
  clubId: string;
  memberId: string;
  before: Record<string, unknown> | undefined;
  after: Record<string, unknown> | undefined;
}): Promise<void> {
  const { firestore, clubId, memberId } = params;
  const delta = memberChatDelta(params.before, params.after);
  const clubSnap = await firestore.collection("clubs").doc(clubId).get();
  const adminIds = stringArray(clubSnap.data()?.adminIds);
  // Un admin déclaré dans `adminIds` (uid ou memberId) reste dans le staff.
  const staff: ParticipantDelta = {
    add: delta.staff.add,
    remove: delta.staff.remove.filter(
      (uid) => !adminIds.includes(uid) && !adminIds.includes(memberId),
    ),
  };

  const changes: Array<[string, ParticipantDelta]> = [
    ["club", delta.club],
    ["staff", staff],
  ];
  for (const [systemKey, change] of changes) {
    if (change.add.length === 0 && change.remove.length === 0) continue;
    const conv = await findSystemConversation(firestore, clubId, systemKey);
    if (!conv) {
      // Première fiche du club : création complète des deux chats.
      await syncClubWideConversations({ firestore, clubId });
      break;
    }
    if (change.add.length > 0) {
      await conv.ref.update({
        participantUids: FieldValue.arrayUnion(...change.add),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    if (change.remove.length > 0) {
      await conv.ref.update({
        participantUids: FieldValue.arrayRemove(...change.remove),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  for (const uid of delta.leftUids) {
    if (await isClubGuardian(firestore, clubId, uid)) continue;
    await removeUidFromClubConversations({ firestore, clubId, uid });
  }
}

function defineGuardianWrittenTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentWritten(
    {
      document: "clubs/{clubId}/members/{memberId}/guardians/{parentUid}",
      database: databaseId,
      region: REGION,
    },
    async (event) =>
      runWithDatabase(databaseId, async () => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        const wasActive = String(before?.status ?? "") === "active";
        const isActive = String(after?.status ?? "") === "active";
        if (wasActive === isActive) return;
        const { clubId, memberId } = event.params;
        const parentUid =
          String(after?.parentUid ?? before?.parentUid ?? "").trim() ||
          event.params.parentUid;
        try {
          await applyGuardianChatChange({
            firestore: db(),
            clubId,
            memberId,
            parentUid,
            isActive,
          });
        } catch (error) {
          console.error("applyGuardianChatChange failed", {
            clubId,
            memberId,
            error,
          });
        }
      }),
  );
}

/**
 * Lien parent activé / révoqué : resync des chats `parents` des équipes de
 * l'enfant et des canaux ciblés ; un parent qui n'a plus aucun lien dans le
 * club (ni fiche) sort de ses DM et groupes coachs.
 */
async function applyGuardianChatChange(params: {
  firestore: Firestore;
  clubId: string;
  memberId: string;
  parentUid: string;
  isActive: boolean;
}): Promise<void> {
  const { firestore, clubId, memberId, parentUid, isActive } = params;
  const clubRef = firestore.collection("clubs").doc(clubId);
  const memberSnap = await clubRef.collection("members").doc(memberId).get();
  const teamIds = memberSnap.exists
    ? await childTeamIds(firestore, clubId, memberId, memberSnap.data() ?? {})
    : [];
  for (const teamId of teamIds) {
    const teamSnap = await clubRef.collection("teams").doc(teamId).get();
    if (!teamSnap.exists) continue;
    await syncTeamConversations({ firestore, clubId, teamId, teamData: teamSnap.data() });
  }
  await syncScopedChannels({ firestore, clubId });

  if (isActive) return;
  if (await isClubGuardian(firestore, clubId, parentUid)) return;
  if (await isClubMemberAccount(firestore, clubId, parentUid)) return;
  await removeUidFromClubConversations({
    firestore,
    clubId,
    uid: parentUid,
    types: PRIVATE_CONVERSATION_TYPES,
  });
}

function defineClubWrittenTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentWritten(
    {
      document: "clubs/{clubId}",
      database: databaseId,
      region: REGION,
    },
    async (event) =>
      runWithDatabase(databaseId, async () => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!after) return;
        const beforeAdmins = stringArray(before?.adminIds).sort().join(",");
        const afterAdmins = stringArray(after.adminIds).sort().join(",");
        if (beforeAdmins === afterAdmins) return;
        const clubId = event.params.clubId;
        try {
          await syncClubWideConversations({ firestore: db(), clubId });
        } catch (error) {
          console.error("syncClubWideConversations (club) failed", {
            clubId,
            error,
          });
        }
      }),
  );
}

function defineSeasonChatPurge(databaseId: FirestoreDatabaseId) {
  return onSchedule(
    {
      schedule: "0 3 * * *",
      timeZone: "Europe/Paris",
      region: REGION,
    },
    async () =>
      runWithDatabase(databaseId, async () => {
        const firestore = db();
        const now = new Date();
        // Clubs dont seasonEndDate est dans les 48 h passées (fenêtre quotidienne).
        const windowStart = admin.firestore.Timestamp.fromDate(
          new Date(now.getTime() - 48 * 60 * 60 * 1000),
        );
        const windowEnd = admin.firestore.Timestamp.fromDate(now);
        const clubsSnap = await firestore
          .collection("clubs")
          .where("seasonEndDate", ">=", windowStart)
          .where("seasonEndDate", "<=", windowEnd)
          .get();

        for (const clubDoc of clubsSnap.docs) {
          // Fenêtre de 48 h → le job voit deux fois la même fin de saison.
          const seasonEndMs = clubDoc.data().seasonEndDate?.toMillis?.() ?? null;
          const purgedMs = clubDoc.data().chatPurgedSeasonEndDate?.toMillis?.() ?? null;
          if (seasonEndMs != null && seasonEndMs === purgedMs) continue;
          try {
            await purgeClubChat(firestore, clubDoc.ref);
            await clubDoc.ref.update({
              chatPurgedSeasonEndDate: clubDoc.data().seasonEndDate,
            });
          } catch (error) {
            console.error("scheduleSeasonChatPurge failed", {
              clubId: clubDoc.id,
              error,
            });
          }
        }
      }),
  );
}

/**
 * Purge de fin de saison d'un club : messages, médias Storage (l'avatar des
 * groupes est gardé), non-lus remis à zéro. Les conversations sans
 * participant (équipe supprimée, canal vidé) sont supprimées.
 */
async function purgeClubChat(
  firestore: Firestore,
  clubRef: DocumentReference,
): Promise<void> {
  const bucket = getStorage().bucket();
  const convs = await clubRef.collection("conversations").get();
  for (const conv of convs.docs) {
    let snap = await conv.ref.collection("messages").limit(400).get();
    while (!snap.empty) {
      const batch = firestore.batch();
      for (const msg of snap.docs) batch.delete(msg.ref);
      await batch.commit();
      snap = await conv.ref.collection("messages").limit(400).get();
    }

    const participantUids = stringArray(conv.data().participantUids);
    const [files] = await bucket.getFiles({
      prefix: `clubs/${clubRef.id}/chat/${conv.id}/`,
    });
    const keepAvatar = participantUids.length > 0;
    await Promise.all(
      files
        .filter((file) => !keepAvatar || !file.name.endsWith("/avatar.jpg"))
        .map((file) => file.delete({ ignoreNotFound: true })),
    );

    const stateId = `${clubRef.id}_${conv.id}`;
    for (let i = 0; i < participantUids.length; i += 400) {
      const batch = firestore.batch();
      for (const uid of participantUids.slice(i, i + 400)) {
        batch.set(
          firestore.collection("users").doc(uid).collection("chatState").doc(stateId),
          { unreadCount: 0, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
      }
      await batch.commit();
    }

    if (!keepAvatar) {
      await conv.ref.delete();
      continue;
    }
    // `lastMessageAt` inchangé : sans expéditeur, aucun non-lu « fantôme ».
    await conv.ref.update({
      lastMessagePreview: "",
      lastSenderUid: FieldValue.delete(),
      lastSenderFirstName: FieldValue.delete(),
      lastSenderRole: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

const CHANNEL_SCOPE_TYPES = new Set<ChannelAudienceScopeType>([
  "categories",
  "teams",
  "parents",
]);

/** Parse scopeType + scopeIds (compat `categoryKey` legacy). */
function parseChannelScope(data: Record<string, unknown> | undefined): {
  scopeType: ChannelAudienceScopeType;
  scopeIds: string[];
} {
  const rawType =
    typeof data?.scopeType === "string" ? data.scopeType.trim() : "";
  const scopeIds = uniq(stringArray(data?.scopeIds).map((id) => id.trim()));
  if (rawType && CHANNEL_SCOPE_TYPES.has(rawType as ChannelAudienceScopeType)) {
    if (scopeIds.length === 0) {
      throw new HttpsError("invalid-argument", "scopeIds requis");
    }
    return {
      scopeType: rawType as ChannelAudienceScopeType,
      scopeIds,
    };
  }
  // Compat anciens clients : categoryKey seul → catégories.
  const categoryKey =
    typeof data?.categoryKey === "string" ? data.categoryKey.trim() : "";
  if (!categoryKey) {
    throw new HttpsError(
      "invalid-argument",
      "scopeType / scopeIds (ou categoryKey) requis",
    );
  }
  return { scopeType: "categories", scopeIds: [categoryKey] };
}

/** Callable admin : crée un canal ciblé (lecture seule par défaut). */
async function handleCreateCategoryChannel(request: CallableRequest): Promise<{
  conversationId: string;
}> {
  const uid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const title = requireString(request.data?.title, "title");
  if (title.length > CONVERSATION_TITLE_MAX) {
    throw new HttpsError(
      "invalid-argument",
      `title : ${CONVERSATION_TITLE_MAX} caractères max`,
    );
  }
  const { scopeType, scopeIds } = parseChannelScope(
    request.data as Record<string, unknown> | undefined,
  );
  const writePolicy =
    typeof request.data?.writePolicy === "string" &&
    request.data.writePolicy.trim()
      ? String(request.data.writePolicy).trim()
      : "admins_only";
  if (!CHANNEL_WRITE_POLICIES.has(writePolicy)) {
    throw new HttpsError("invalid-argument", "writePolicy inconnue");
  }

  // Admin via `adminIds`, index `member_accounts` ou fiche directe à son uid
  // (même résolution que les autres callables admin).
  await assertClubAdmin(clubId, uid);
  const firestore = db();

  // Même cible = même `systemKey` : on n'écrase pas le titre / la politique
  // d'un canal existant (un canal vidé par la purge peut être recréé).
  const existing = await findSystemConversation(
    firestore,
    clubId,
    channelScopeSystemKey(scopeType, scopeIds),
  );
  if (existing && stringArray(existing.data().participantUids).length > 0) {
    throw new HttpsError("already-exists", "Un canal existe déjà pour cette cible", {
      reason: CHANNEL_EXISTS_REASON,
    });
  }

  const participantUids = await resolveScopedChannelParticipants({
    firestore,
    clubId,
    scopeType,
    scopeIds,
  });
  if (participantUids.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Aucun participant pour cette cible",
    );
  }

  const conversationId = await createScopedChannelConversation({
    firestore,
    clubId,
    scopeType,
    scopeIds,
    title,
    participantUids,
    writePolicy,
  });
  return { conversationId };
}

export const onMemberWrittenForChat = defineMemberWrittenTrigger("v2-prod");
export const onMemberWrittenForChatDev = defineMemberWrittenTrigger("v2-dev");
export const onClubWrittenForChat = defineClubWrittenTrigger("v2-prod");
export const onClubWrittenForChatDev = defineClubWrittenTrigger("v2-dev");
export const onGuardianWrittenForChat = defineGuardianWrittenTrigger("v2-prod");
export const onGuardianWrittenForChatDev = defineGuardianWrittenTrigger("v2-dev");
export const scheduleSeasonChatPurge = defineSeasonChatPurge("v2-prod");
export const scheduleSeasonChatPurgeDev = defineSeasonChatPurge("v2-dev");

export const { prod: createCategoryChannel, dev: createCategoryChannelDev } =
  defineDualCallable(handleCreateCategoryChannel);
