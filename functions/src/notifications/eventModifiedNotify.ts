import * as admin from "firebase-admin";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { stringArray } from "../common";
import { ClubDirectory, resolveEventAudience } from "./audience";
import { eventModifiedCopy } from "./copy";
import { describeChanges, type ModifiedEventField } from "./eventChange";
import {
  contextForEntry,
  eventPushContext,
  sendEventPushToAudience,
} from "./eventPush";
import { EVENT_MODIFIED_DEBOUNCE_MS } from "./types";

/**
 * Accumule les champs modifiés d'un event et (re)pousse l'échéance : un coach
 * qui corrige lieu puis heure en 30 s n'envoie qu'une push qui dit tout.
 */
export async function scheduleEventModifiedNotify(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  fields: ModifiedEventField[];
  excludeUid?: string;
}): Promise<void> {
  if (params.fields.length === 0) return;
  const eventRef = params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("events")
    .doc(params.eventId);

  await params.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(eventRef);
    if (!snap.exists) return;
    const pending = (snap.data()?.modifiedNotifyPending ?? {}) as DocumentData;
    const fields = new Set([...stringArray(pending.fields), ...params.fields]);
    const excludeUids = new Set(stringArray(pending.excludeUids));
    if (params.excludeUid) excludeUids.add(params.excludeUid);
    tx.update(eventRef, {
      modifiedNotifyPending: {
        fields: [...fields],
        excludeUids: [...excludeUids],
      },
      modifiedNotifyDueAt: admin.firestore.Timestamp.fromMillis(
        Date.now() + EVENT_MODIFIED_DEBOUNCE_MS,
      ),
    });
  });
}

/** Envoie les push « modifié » dont le délai de regroupement est échu. */
export async function flushDueEventModifiedNotifications(params: {
  firestore: Firestore;
  clubId: string;
  now: admin.firestore.Timestamp;
}): Promise<void> {
  const eventsSnap = await params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("events")
    .where("modifiedNotifyDueAt", "<=", params.now)
    .limit(40)
    .get();
  if (eventsSnap.empty) return;

  const directory = new ClubDirectory(params.firestore, params.clubId);
  for (const eventDoc of eventsSnap.docs) {
    // Claim transactionnel : un seul cron envoie.
    const claimed = await params.firestore.runTransaction(async (tx) => {
      const snap = await tx.get(eventDoc.ref);
      if (!snap.exists || snap.data()?.modifiedNotifyDueAt == null) return null;
      const data = snap.data()!;
      tx.update(eventDoc.ref, {
        modifiedNotifyPending: admin.firestore.FieldValue.delete(),
        modifiedNotifyDueAt: admin.firestore.FieldValue.delete(),
      });
      return data;
    });
    if (!claimed || claimed.canceled === true) continue;

    const pending = (claimed.modifiedNotifyPending ?? {}) as DocumentData;
    const changes = describeChanges(claimed, stringArray(pending.fields));
    if (changes.length === 0) continue;

    const base = eventPushContext(claimed);
    const entries = await resolveEventAudience(directory, claimed);
    await sendEventPushToAudience({
      firestore: params.firestore,
      clubId: params.clubId,
      eventId: eventDoc.id,
      eventData: claimed,
      type: "event_modified",
      entries,
      excludeUids: stringArray(pending.excludeUids),
      copyFor: (entry) =>
        eventModifiedCopy({ ...contextForEntry(base, entry), changes }),
    });
  }
}
