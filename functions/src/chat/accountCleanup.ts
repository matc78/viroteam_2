import * as admin from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";
import { writePolicyAfterRemoval } from "./memberChatDiff";

const FieldValue = admin.firestore.FieldValue;
const PAGE_SIZE = 400;

/**
 * Champs de contenu retirés d'un message supprimé (alignés `firestore.rules`,
 * `messageContentKeys`) ; le média Storage part via `onChatMessageUpdated`.
 */
const MESSAGE_CONTENT_FIELDS = [
  "text",
  "downloadUrl",
  "thumbUrl",
  "reactions",
  "replyToMessageId",
  "replyToText",
  "replyToSenderUid",
  "pollQuestion",
  "pollOptions",
  "pollVotes",
  "pollAllowMultiple",
];

/**
 * Suppression de compte : dans chaque conversation du club où [uid]
 * participe, ses messages sont vidés (comme un soft-delete) puis l'uid est
 * retiré des participants (DM fermé s'il ne reste qu'une personne).
 * À appeler avant l'anonymisation des fiches, tant que l'uid est encore
 * participant.
 */
export async function purgeUserFromClubChats(params: {
  firestore: Firestore;
  clubId: string;
  uid: string;
}): Promise<void> {
  const { firestore, clubId, uid } = params;
  const convs = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("conversations")
    .where("participantUids", "array-contains", uid)
    .get();

  const scrub: Record<string, unknown> = {
    deletedAt: FieldValue.serverTimestamp(),
    deletedByUid: uid,
  };
  for (const field of MESSAGE_CONTENT_FIELDS) scrub[field] = FieldValue.delete();

  for (const conv of convs.docs) {
    let page = await conv.ref
      .collection("messages")
      .where("senderUid", "==", uid)
      .orderBy("__name__")
      .limit(PAGE_SIZE)
      .get();
    while (!page.empty) {
      const batch = firestore.batch();
      for (const message of page.docs) {
        if (message.data().deletedAt != null) continue;
        batch.update(message.ref, scrub);
      }
      await batch.commit();
      if (page.size < PAGE_SIZE) break;
      page = await conv.ref
        .collection("messages")
        .where("senderUid", "==", uid)
        .orderBy("__name__")
        .startAfter(page.docs[page.docs.length - 1]!)
        .limit(PAGE_SIZE)
        .get();
    }

    const data = conv.data();
    await conv.ref.update({
      participantUids: FieldValue.arrayRemove(uid),
      writePolicy: writePolicyAfterRemoval({
        type: data.type,
        participantUids: data.participantUids,
        removedUid: uid,
        writePolicy: data.writePolicy,
      }),
      ...(String(data.lastSenderUid ?? "") === uid
        ? { lastSenderFirstName: FieldValue.delete() }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
