import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { requireString, requireUid, stringArray, uniq } from "../common";
import { db, defineDualCallable, runWithDatabase, type FirestoreDatabaseId } from "../db";
import { buildPushData, sendPushToUids } from "../notifications/send";
import { createCategoryConversation, syncClubWideConversations } from "./sync";

const REGION = "europe-west1";

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
        try {
          await syncClubWideConversations({ firestore: db(), clubId });
        } catch (error) {
          console.error("syncClubWideConversations failed", { clubId, error });
        }
      }),
  );
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

function defineMessageCreatedTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentCreated(
    {
      document: "clubs/{clubId}/conversations/{conversationId}/messages/{messageId}",
      database: databaseId,
      region: REGION,
    },
    async (event) =>
      runWithDatabase(databaseId, async () => {
        const data = event.data?.data();
        if (!data) return;
        const clubId = event.params.clubId;
        const conversationId = event.params.conversationId;
        const senderUid = String(data.senderUid ?? "").trim();
        const firestore = db();

        const convSnap = await firestore
          .collection("clubs")
          .doc(clubId)
          .collection("conversations")
          .doc(conversationId)
          .get();
        if (!convSnap.exists) return;
        const conv = convSnap.data() ?? {};
        const participants = stringArray(conv.participantUids).filter(
          (uid) => uid && uid !== senderUid,
        );
        if (participants.length === 0) return;

        // Filtre muted + lecture active (thread encore ouvert / markRead en vol).
        // Court : le client markRead dès que le fil est ouvert ; une fenêtre
        // trop longue masque les non-lus après avoir quitté la discussion.
        const ACTIVE_READ_MS = 15_000;
        const unmuted: string[] = [];
        for (const uid of participants) {
          const stateId = `${clubId}_${conversationId}`;
          const stateSnap = await firestore
            .collection("users")
            .doc(uid)
            .collection("chatState")
            .doc(stateId)
            .get();
          const stateData = stateSnap.data();
          if (stateData?.muted === true) continue;

          const lastReadAt = stateData?.lastReadAt;
          const lastReadMs =
            lastReadAt && typeof lastReadAt.toMillis === "function"
              ? lastReadAt.toMillis()
              : 0;
          const activelyReading =
            lastReadMs > 0 && Date.now() - lastReadMs < ACTIVE_READ_MS;
          if (activelyReading) continue;

          unmuted.push(uid);
          // Incrémente unread best-effort
          await stateSnap.ref.set(
            {
              unreadCount: admin.firestore.FieldValue.increment(1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }

        const preview =
          data.type === "image"
            ? "📷 Photo"
            : data.type === "poll"
              ? `📊 ${String(data.pollQuestion ?? data.text ?? "Sondage").trim().slice(0, 100)}`
              : String(data.text ?? "").trim().slice(0, 120);

        // DM 1:1 : titre = nom de l’expéditeur (pas le title figé = cible).
        const isDm =
          String(conv.type ?? "") === "dm" &&
          stringArray(conv.participantUids).length <= 2;
        let title = String(conv.titleOverride || "").trim();
        if (!title && isDm && senderUid) {
          const senderSnap = await firestore.collection("users").doc(senderUid).get();
          const senderData = senderSnap.data() ?? {};
          title =
            String(senderData.displayName ?? "").trim() ||
            `${String(senderData.firstName ?? "").trim()} ${String(senderData.lastName ?? "").trim()}`.trim();
        }
        if (!title) {
          title = String(conv.title || "Message").trim() || "Message";
        }

        await sendPushToUids({
          firestore,
          uids: unmuted,
          payload: {
            title,
            body: preview || "Nouveau message",
            preferenceKey: "chat",
            data: buildPushData({
              type: "chat_message",
              clubId,
              preferenceKey: "chat",
              deepLink: `viroteam://chat?clubId=${encodeURIComponent(clubId)}&conversationId=${encodeURIComponent(conversationId)}`,
              webPath: `/messages?clubId=${encodeURIComponent(clubId)}&conversationId=${encodeURIComponent(conversationId)}`,
              extra: { conversationId },
            }),
          },
        });
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
          const convs = await clubDoc.ref.collection("conversations").get();
          for (const conv of convs.docs) {
            let snap = await conv.ref.collection("messages").limit(400).get();
            while (!snap.empty) {
              const batch = firestore.batch();
              for (const msg of snap.docs) batch.delete(msg.ref);
              await batch.commit();
              snap = await conv.ref.collection("messages").limit(400).get();
            }
            await conv.ref.set(
              {
                lastMessagePreview: "",
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
          }
        }
      }),
  );
}

/** Callable admin : crée un canal catégorie (lecture seule par défaut). */
async function handleCreateCategoryChannel(request: CallableRequest): Promise<{
  conversationId: string;
}> {
  const uid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const categoryKey = requireString(request.data?.categoryKey, "categoryKey");
  const title = requireString(request.data?.title, "title");
  const writePolicy =
    typeof request.data?.writePolicy === "string" &&
    request.data.writePolicy.trim()
      ? String(request.data.writePolicy).trim()
      : "admins_only";

  const firestore = db();
  const clubSnap = await firestore.collection("clubs").doc(clubId).get();
  if (!clubSnap.exists) throw new HttpsError("not-found", "Club introuvable");
  const adminIds = stringArray(clubSnap.data()?.adminIds);
  const memberAccount = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("member_accounts")
    .doc(uid)
    .get();
  let isAdmin = adminIds.includes(uid);
  if (!isAdmin && memberAccount.exists) {
    const memberId = String(memberAccount.data()?.memberId ?? "").trim();
    const memberSnap = await firestore
      .collection("clubs")
      .doc(clubId)
      .collection("members")
      .doc(memberId)
      .get();
    isAdmin = String(memberSnap.data()?.role ?? "") === "admin";
  }
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Réservé aux admins");
  }

  // Participants = tous licenciés + parents optionnels : MVP = tous accountUid.
  const membersSnap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .get();
  const participantUids: string[] = [];
  for (const doc of membersSnap.docs) {
    const data = doc.data();
    if (String(data.status ?? "") === "archived") continue;
    const accountUid = String(data.accountUid ?? data.userId ?? "").trim();
    if (accountUid) participantUids.push(accountUid);
  }

  const conversationId = await createCategoryConversation({
    firestore,
    clubId,
    categoryKey,
    title,
    participantUids: uniq(participantUids),
    writePolicy,
  });
  return { conversationId };
}

export const onMemberWrittenForChat = defineMemberWrittenTrigger("v2-prod");
export const onMemberWrittenForChatDev = defineMemberWrittenTrigger("v2-dev");
export const onClubWrittenForChat = defineClubWrittenTrigger("v2-prod");
export const onClubWrittenForChatDev = defineClubWrittenTrigger("v2-dev");
export const onChatMessageCreatedForPush = defineMessageCreatedTrigger("v2-prod");
export const onChatMessageCreatedForPushDev =
  defineMessageCreatedTrigger("v2-dev");
export const scheduleSeasonChatPurge = defineSeasonChatPurge("v2-prod");
export const scheduleSeasonChatPurgeDev = defineSeasonChatPurge("v2-dev");

export const { prod: createCategoryChannel, dev: createCategoryChannelDev } =
  defineDualCallable(handleCreateCategoryChannel);
