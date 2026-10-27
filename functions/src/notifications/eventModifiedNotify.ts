import * as admin from "firebase-admin";
import type {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { stringArray } from "../common";
import { ClubDirectory, resolveEventAudience } from "./audience";
import {
  clubDirectoryCache,
  clubIdOfEvent,
  isClubEventDoc,
  logScheduledFailure,
} from "./clubEvents";
import { eventModifiedCopy } from "./copy";
import { describeChanges, type ModifiedEventField } from "./eventChange";
import {
  contextForEntry,
  eventPushContext,
  sendEventPushToAudience,
} from "./eventPush";
import { calendarDaysUntil } from "./deepLinks";
import {
  EVENT_MODIFIED_DEBOUNCE_MS,
  EVENT_MODIFIED_SAME_DAY_DEBOUNCE_MS,
} from "./types";

/**
 * Délai de regroupement selon la date de l'event : 10 min en général, 2 min
 * le jour J (ou sans date) pour qu'un changement de dernière minute arrive à temps.
 */
export function eventModifiedDebounceMs(params: {
  eventDateId: string;
  now: Date;
}): number {
  const dateId = params.eventDateId.trim();
  if (!dateId) return EVENT_MODIFIED_SAME_DAY_DEBOUNCE_MS;
  return calendarDaysUntil({ now: params.now, eventDateId: dateId }) <= 0
    ? EVENT_MODIFIED_SAME_DAY_DEBOUNCE_MS
    : EVENT_MODIFIED_DEBOUNCE_MS;
}

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
    const eventData = snap.data() ?? {};
    const pending = (eventData.modifiedNotifyPending ?? {}) as DocumentData;
    const fields = new Set([...stringArray(pending.fields), ...params.fields]);
    const excludeUids = new Set(stringArray(pending.excludeUids));
    if (params.excludeUid) excludeUids.add(params.excludeUid);
    tx.update(eventRef, {
      modifiedNotifyPending: {
        fields: [...fields],
        excludeUids: [...excludeUids],
      },
      modifiedNotifyDueAt: admin.firestore.Timestamp.fromMillis(
        Date.now() +
          eventModifiedDebounceMs({
            eventDateId: String(eventData.dateId ?? ""),
            now: new Date(),
          }),
      ),
    });
  });
}

/** Envoie les push « modifié » dont le délai de regroupement est échu. */
export async function flushDueEventModifiedNotifications(params: {
  firestore: Firestore;
  now: admin.firestore.Timestamp;
}): Promise<void> {
  const eventsSnap = await params.firestore
    .collectionGroup("events")
    .where("modifiedNotifyDueAt", "<=", params.now)
    .limit(200)
    .get();
  if (eventsSnap.empty) return;

  const directoryFor = clubDirectoryCache(params.firestore);
  for (const eventDoc of eventsSnap.docs.filter(isClubEventDoc)) {
    const clubId = clubIdOfEvent(eventDoc.ref);
    try {
      await flushEventModified({
        firestore: params.firestore,
        directory: directoryFor(clubId),
        eventDoc,
      });
    } catch (error) {
      logScheduledFailure("push « modifié »", { clubId, eventId: eventDoc.id, error });
    }
  }
}

/** Envoie la push « modifié » d'un événement dont le regroupement est échu. */
async function flushEventModified(params: {
  firestore: Firestore;
  directory: ClubDirectory;
  eventDoc: QueryDocumentSnapshot;
}): Promise<void> {
  const { eventDoc, directory } = params;
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
  if (!claimed || claimed.canceled === true) return;

  const pending = (claimed.modifiedNotifyPending ?? {}) as DocumentData;
  const changes = describeChanges(claimed, stringArray(pending.fields));
  if (changes.length === 0) return;

  const base = eventPushContext(claimed);
  const entries = await resolveEventAudience(directory, claimed);
  await sendEventPushToAudience({
    firestore: params.firestore,
    clubId: directory.clubId,
    eventId: eventDoc.id,
    eventData: claimed,
    type: "event_modified",
    entries,
    excludeUids: stringArray(pending.excludeUids),
    copyFor: (entry) =>
      eventModifiedCopy({ ...contextForEntry(base, entry), changes }),
  });
}
