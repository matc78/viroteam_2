import * as admin from "firebase-admin";
import type {
  DocumentData,
  DocumentReference,
  Firestore,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { defineBoolean } from "firebase-functions/params";
import { stringArray } from "../common";
import { db, runWithDatabase, type FirestoreDatabaseId } from "../db";
import { buildPushData, sendPushToUids } from "../notifications/send";
import {
  chatMessagePreviewText,
  chatPushContent,
  chatReplySnapshot,
  chatSenderNames,
  chatSenderRole,
  shouldAdvanceChatPreview,
} from "./preview";

const REGION = "europe-west1";
const MESSAGE_DOCUMENT =
  "clubs/{clubId}/conversations/{conversationId}/messages/{messageId}";

/**
 * Messagerie cachée en prod tant que ce param est `false` (défaut) : aucun
 * push `chat_message` ne part. Param public dotenv (`functions/.env.<projet>`,
 * écrit par le workflow deploy-functions) — passer à `true` le jour où la
 * messagerie est ouverte aux clubs.
 */
const chatMessagingLive = defineBoolean("CHAT_MESSAGING_LIVE", {
  default: false,
});

/**
 * Lu il y a moins de ce délai → fil encore ouvert, pas de non-lu. Court : le
 * client markRead dès que le fil est ouvert ; une fenêtre trop longue masque
 * les non-lus après avoir quitté la discussion.
 */
const ACTIVE_READ_MS = 15_000;

/** Lectures `getAll` / écritures batch par paquet (limite batch = 500). */
const FANOUT_CHUNK = 400;

const FieldValue = admin.firestore.FieldValue;

type ChatSender = { firstName: string; fullName: string; role: string };

function millisOf(raw: unknown): number | null {
  if (raw && typeof (raw as { toMillis?: unknown }).toMillis === "function") {
    return (raw as admin.firestore.Timestamp).toMillis();
  }
  return null;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function conversationRef(
  firestore: Firestore,
  clubId: string,
  conversationId: string,
): DocumentReference {
  return firestore
    .collection("clubs")
    .doc(clubId)
    .collection("conversations")
    .doc(conversationId);
}

/**
 * Prénom, nom et rôle club de l'expéditeur, lus côté serveur (le client
 * n'écrit plus l'aperçu). Pas de fiche membre → parent.
 */
async function resolveChatSender(
  firestore: Firestore,
  clubId: string,
  senderUid: string,
): Promise<ChatSender> {
  if (!senderUid) return { firstName: "", fullName: "", role: "parent" };
  const clubRef = firestore.collection("clubs").doc(clubId);
  const [userSnap, accountSnap, directMemberSnap] = await firestore.getAll(
    firestore.collection("users").doc(senderUid),
    clubRef.collection("member_accounts").doc(senderUid),
    clubRef.collection("members").doc(senderUid),
  );
  const linkedMemberId = String(accountSnap?.data()?.memberId ?? "").trim();
  let memberData = directMemberSnap?.data();
  if (linkedMemberId && linkedMemberId !== senderUid) {
    const linked = await clubRef.collection("members").doc(linkedMemberId).get();
    memberData = linked.data() ?? memberData;
  }
  return {
    ...chatSenderNames(userSnap?.data()),
    role: chatSenderRole(memberData?.role),
  };
}

/**
 * Pose `fanoutAt`, fige la citation et avance l'aperçu de la conversation,
 * le tout en transaction. Retourne la conversation, ou `null` si le message
 * a déjà été traité (livraison « at-least-once ») ou n'existe plus.
 */
async function claimMessageAndUpdatePreview(params: {
  firestore: Firestore;
  convRef: DocumentReference;
  messageRef: DocumentReference;
  senderUid: string;
  sender: ChatSender;
}): Promise<DocumentData | null> {
  const { firestore, convRef, messageRef, senderUid, sender } = params;
  return firestore.runTransaction(async (tx) => {
    const [messageSnap, convSnap] = await tx.getAll(messageRef, convRef);
    const message = messageSnap?.data();
    const conversation = convSnap?.data();
    if (!message || !conversation || message.fanoutAt != null) return null;

    const replyToMessageId = String(message.replyToMessageId ?? "").trim();
    const replySource = replyToMessageId
      ? (await tx.get(convRef.collection("messages").doc(replyToMessageId))).data()
      : undefined;

    const messageUpdate: Record<string, unknown> = {
      fanoutAt: FieldValue.serverTimestamp(),
    };
    if (replyToMessageId) {
      // Le serveur fait foi : la citation reflète le vrai message cité.
      const reply = chatReplySnapshot(replySource);
      messageUpdate.replyToText = reply?.replyToText ?? FieldValue.delete();
      messageUpdate.replyToSenderUid =
        reply?.replyToSenderUid ?? FieldValue.delete();
    }
    tx.update(messageRef, messageUpdate);

    const createdMs = millisOf(message.createdAt) ?? Date.now();
    if (shouldAdvanceChatPreview(createdMs, millisOf(conversation.lastMessageAt))) {
      tx.update(convRef, {
        lastMessageAt: message.createdAt ?? FieldValue.serverTimestamp(),
        lastMessagePreview: chatMessagePreviewText(message),
        lastSenderUid: senderUid,
        lastSenderFirstName: sender.firstName || FieldValue.delete(),
        lastSenderRole: sender.role,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return conversation;
  });
}

/**
 * Incrémente `unreadCount` des destinataires (hors muets et lecteurs actifs)
 * par lots, et retourne les uids à notifier.
 */
async function incrementUnreadCounts(params: {
  firestore: Firestore;
  clubId: string;
  conversationId: string;
  recipientUids: string[];
}): Promise<string[]> {
  const { firestore, clubId, conversationId, recipientUids } = params;
  const stateId = `${clubId}_${conversationId}`;
  const notified: string[] = [];
  const now = Date.now();

  for (const uids of chunks(recipientUids, FANOUT_CHUNK)) {
    const refs = uids.map((uid) =>
      firestore.collection("users").doc(uid).collection("chatState").doc(stateId),
    );
    const snaps = await firestore.getAll(...refs);
    const batch = firestore.batch();
    snaps.forEach((snap, index) => {
      const state = snap.data();
      if (state?.muted === true) return;
      const lastReadMs = millisOf(state?.lastReadAt);
      if (lastReadMs != null && now - lastReadMs < ACTIVE_READ_MS) return;
      notified.push(uids[index]!);
      batch.set(
        refs[index]!,
        {
          unreadCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
  }
  return notified;
}

/**
 * Nouveau message : aperçu inbox, citation figée, non-lus puis push.
 * Seule source de l'aperçu (les règles interdisent au client de l'écrire).
 */
async function handleMessageCreated(params: {
  clubId: string;
  conversationId: string;
  messageId: string;
  message: DocumentData;
}): Promise<void> {
  const { clubId, conversationId, messageId, message } = params;
  const firestore = db();
  const senderUid = String(message.senderUid ?? "").trim();
  const convRef = conversationRef(firestore, clubId, conversationId);
  const sender = await resolveChatSender(firestore, clubId, senderUid);

  const conversation = await claimMessageAndUpdatePreview({
    firestore,
    convRef,
    messageRef: convRef.collection("messages").doc(messageId),
    senderUid,
    sender,
  });
  if (!conversation) return;

  const recipientUids = stringArray(conversation.participantUids).filter(
    (uid) => uid && uid !== senderUid,
  );
  if (recipientUids.length === 0) return;
  const notifiedUids = await incrementUnreadCounts({
    firestore,
    clubId,
    conversationId,
    recipientUids,
  });

  // Garde : pas de push tant que la messagerie n'est pas ouverte
  // (les compteurs non-lus ci-dessus restent maintenus).
  if (!chatMessagingLive.value() || notifiedUids.length === 0) return;

  const { title, body } = chatPushContent({
    conversation,
    senderFirstName: sender.firstName,
    senderFullName: sender.fullName,
    preview: chatMessagePreviewText(message),
  });
  await sendPushToUids({
    firestore,
    uids: notifiedUids,
    payload: {
      title,
      body,
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
}

/**
 * Supprime le média Storage d'un message (photo + miniature, quelle que soit
 * l'extension écrite par l'app ou le portail). Le chemin doit rester dans le
 * dossier chat de la conversation.
 */
export async function deleteChatMessageMedia(params: {
  clubId: string;
  conversationId: string;
  messageId: string;
  storagePath: unknown;
}): Promise<void> {
  const storagePath = String(params.storagePath ?? "").trim();
  const conversationDir = `clubs/${params.clubId}/chat/${params.conversationId}/`;
  if (!storagePath.startsWith(conversationDir)) return;
  const folder = storagePath.slice(0, storagePath.lastIndexOf("/") + 1);
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: `${folder}${params.messageId}` });
  await Promise.all(
    files
      .filter((file) => {
        const name = file.name.slice(folder.length);
        return (
          name.startsWith(`${params.messageId}.`) ||
          name.startsWith(`${params.messageId}_thumb.`)
        );
      })
      .map((file) => file.delete({ ignoreNotFound: true })),
  );
}

/** Rafraîchit l'aperçu si [messageId] est le dernier message de la conversation. */
async function refreshPreviewIfLatest(params: {
  convRef: DocumentReference;
  messageId: string;
  message: DocumentData;
}): Promise<void> {
  const latest = await params.convRef
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (latest.docs[0]?.id !== params.messageId) return;
  await params.convRef.update({
    lastMessagePreview: chatMessagePreviewText(params.message),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Message modifié : soft-delete → suppression du média + aperçu « Message
 * supprimé » ; édition du texte → aperçu à jour. Les écritures serveur
 * (`fanoutAt`, citation, nettoyage) ne déclenchent rien.
 */
async function handleMessageUpdated(params: {
  clubId: string;
  conversationId: string;
  messageId: string;
  before: DocumentData;
  after: DocumentData;
}): Promise<void> {
  const { clubId, conversationId, messageId, before, after } = params;
  const firestore = db();
  const convRef = conversationRef(firestore, clubId, conversationId);
  const justDeleted = before.deletedAt == null && after.deletedAt != null;
  const edited = millisOf(before.editedAt) !== millisOf(after.editedAt);

  if (justDeleted) {
    if (after.storagePath != null) {
      await deleteChatMessageMedia({
        clubId,
        conversationId,
        messageId,
        storagePath: after.storagePath,
      });
      await convRef.collection("messages").doc(messageId).update({
        storagePath: FieldValue.delete(),
        width: FieldValue.delete(),
        height: FieldValue.delete(),
      });
    }
    await refreshPreviewIfLatest({ convRef, messageId, message: after });
    return;
  }
  if (edited && after.deletedAt == null) {
    await refreshPreviewIfLatest({ convRef, messageId, message: after });
  }
}

function defineMessageCreatedTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentCreated(
    { document: MESSAGE_DOCUMENT, database: databaseId, region: REGION },
    async (event) =>
      runWithDatabase(databaseId, async () => {
        const message = event.data?.data();
        if (!message) return;
        await handleMessageCreated({
          clubId: event.params.clubId,
          conversationId: event.params.conversationId,
          messageId: event.params.messageId,
          message,
        });
      }),
  );
}

function defineMessageUpdatedTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentUpdated(
    { document: MESSAGE_DOCUMENT, database: databaseId, region: REGION },
    async (event) =>
      runWithDatabase(databaseId, async () => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;
        try {
          await handleMessageUpdated({
            clubId: event.params.clubId,
            conversationId: event.params.conversationId,
            messageId: event.params.messageId,
            before,
            after,
          });
        } catch (error) {
          console.error("onChatMessageUpdated failed", {
            clubId: event.params.clubId,
            conversationId: event.params.conversationId,
            messageId: event.params.messageId,
            error,
          });
        }
      }),
  );
}

// Nom historique conservé : le deploy CI (`--non-interactive`) refuse de
// supprimer une function déployée, renommer le trigger casserait le tag.
export const onChatMessageCreatedForPush = defineMessageCreatedTrigger("v2-prod");
export const onChatMessageCreatedForPushDev =
  defineMessageCreatedTrigger("v2-dev");
export const onChatMessageUpdated = defineMessageUpdatedTrigger("v2-prod");
export const onChatMessageUpdatedDev = defineMessageUpdatedTrigger("v2-dev");
