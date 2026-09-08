import * as admin from "firebase-admin";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import {
  onDocumentCreated,
  onDocumentWritten,
  type Change,
  type DocumentSnapshot,
  type FirestoreEvent,
} from "firebase-functions/v2/firestore";
import { stringArray } from "../common";
import { db, runWithDatabase, type FirestoreDatabaseId } from "../db";
import {
  announcementPublishedCopy,
  eventCanceledCopy,
  eventModifiedCopy,
  eventPostponedCopy,
  eventReminderJ2Copy,
  eventReminderJ7Copy,
} from "./copy";
import {
  calendarDaysUntil,
  dateIdToIsoDate,
  feesDeepLink,
  homeDeepLink,
  parisDateId,
  parisDateLabel,
  planningDeepLink,
} from "./deepLinks";
import {
  immediateReminderKinds,
  isEventContentModified,
  isEventPostponedChange,
  isOnlyPushBookkeepingChange,
} from "./eventChange";
import {
  resolveAnnouncementRecipientUids,
  resolveEventRecipientUids,
} from "./recipients";
import { buildPushData, sendPushToUids } from "./send";

const REGION = "europe-west1";

type EventWrittenEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  { clubId: string; eventId: string }
>;

type AnnouncementCreatedEvent = FirestoreEvent<
  DocumentSnapshot | undefined,
  { clubId: string; announcementId: string }
>;

/**
 * Trigger write event : création (rappels immédiats) / annulation / report /
 * modification.
 */
async function handleEventWritten(event: EventWrittenEvent): Promise<void> {
  const before = event.data?.before?.exists
    ? event.data.before.data()
    : undefined;
  const after = event.data?.after?.exists ? event.data.after.data() : undefined;
  if (!after) return;

  const clubId = event.params.clubId;
  const eventId = event.params.eventId;
  const firestore = db();

  // Création
  if (!before) {
    await handleEventCreated({
      firestore,
      clubId,
      eventId,
      eventData: after,
    });
    return;
  }

  if (after.canceled === true && before.canceled !== true) {
    await sendEventAudiencePush({
      firestore,
      clubId,
      eventId,
      eventData: after,
      type: "event_canceled",
      copy: eventCanceledCopy(String(after.title ?? "")),
    });
    return;
  }

  if (after.canceled === true) return;

  // Ignore les writes purement techniques (flags push) pour éviter les boucles.
  if (before && isOnlyPushBookkeepingChange(before, after)) {
    return;
  }

  if (isEventPostponedChange(before, after)) {
    const dateId = String(after.dateId ?? "").trim();
    const dateLabel = dateId
      ? parisDateLabel(new Date(`${dateIdToIsoDate(dateId)}T12:00:00`))
      : "date à confirmer";
    await sendEventAudiencePush({
      firestore,
      clubId,
      eventId,
      eventData: after,
      type: "event_postponed",
      copy: eventPostponedCopy({
        title: String(after.title ?? ""),
        dateLabel,
        startTime: String(after.startTime ?? ""),
      }),
    });
    // Replanifier : passer des flags à false (ne pas se fier à `after` stale).
    await firestore
      .collection("clubs")
      .doc(clubId)
      .collection("events")
      .doc(eventId)
      .update({
        reminderSentJ7: admin.firestore.FieldValue.delete(),
        reminderSentJ2: admin.firestore.FieldValue.delete(),
      });
    await handleEventCreated({
      firestore,
      clubId,
      eventId,
      eventData: {
        ...after,
        reminderSentJ7: false,
        reminderSentJ2: false,
      },
    });
    return;
  }

  if (isEventContentModified(before, after)) {
    await sendEventAudiencePush({
      firestore,
      clubId,
      eventId,
      eventData: after,
      type: "event_modified",
      copy: eventModifiedCopy(String(after.title ?? "")),
    });
  }
}

async function handleEventCreated(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  eventData: DocumentData;
}): Promise<void> {
  if (params.eventData.canceled === true) return;
  const dateId = String(params.eventData.dateId ?? "").trim();
  if (!dateId) return;

  const daysUntil = calendarDaysUntil({
    now: new Date(),
    eventDateId: dateId,
  });
  const kinds = immediateReminderKinds(daysUntil);
  if (kinds.length === 0) return;

  const updates: Record<string, boolean> = {};
  for (const kind of kinds) {
    if (kind === "j7" && params.eventData.reminderSentJ7 === true) continue;
    if (kind === "j2" && params.eventData.reminderSentJ2 === true) continue;
    const copy =
      kind === "j7"
        ? eventReminderJ7Copy(String(params.eventData.title ?? ""))
        : eventReminderJ2Copy(String(params.eventData.title ?? ""));
    await sendEventAudiencePush({
      firestore: params.firestore,
      clubId: params.clubId,
      eventId: params.eventId,
      eventData: params.eventData,
      type: kind === "j7" ? "event_reminder_j7" : "event_reminder_j2",
      copy,
    });
    if (kind === "j7") updates.reminderSentJ7 = true;
    if (kind === "j2") updates.reminderSentJ2 = true;
  }
  if (Object.keys(updates).length > 0) {
    await params.firestore
      .collection("clubs")
      .doc(params.clubId)
      .collection("events")
      .doc(params.eventId)
      .update(updates);
  }
}

async function sendEventAudiencePush(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  eventData: DocumentData;
  type: string;
  copy: { title: string; body: string };
}): Promise<void> {
  const dateId =
    String(params.eventData.dateId ?? "").trim() || parisDateId(new Date());
  const deepLink = planningDeepLink(params.clubId, dateId);
  const webPath = `/planning?clubId=${encodeURIComponent(params.clubId)}&date=${encodeURIComponent(dateIdToIsoDate(dateId))}`;
  const recipients = await resolveEventRecipientUids({
    firestore: params.firestore,
    clubId: params.clubId,
    teamIds: stringArray(params.eventData.teamIds),
    teamMemberIds: stringArray(params.eventData.teamMemberIds),
  });
  await sendPushToUids({
    firestore: params.firestore,
    uids: recipients,
    payload: {
      title: params.copy.title,
      body: params.copy.body,
      preferenceKey: "events",
      data: buildPushData({
        type: params.type,
        clubId: params.clubId,
        deepLink,
        webPath,
        preferenceKey: "events",
        extra: { eventId: params.eventId, dateId },
      }),
    },
  });
}

async function handleAnnouncementCreated(
  event: AnnouncementCreatedEvent,
): Promise<void> {
  const snap = event.data;
  if (!snap?.exists) return;
  const data = snap.data()!;
  const clubId = event.params.clubId;
  const firestore = db();
  const copy = announcementPublishedCopy(String(data.message ?? ""));
  const deepLink = homeDeepLink(clubId);
  const webPath = `/home?clubId=${encodeURIComponent(clubId)}`;
  const recipients = await resolveAnnouncementRecipientUids({
    firestore,
    clubId,
    targetType: String(data.targetType ?? "Tous les membres"),
    targetIds: stringArray(data.targetIds),
    senderId: String(data.senderId ?? ""),
  });
  await sendPushToUids({
    firestore,
    uids: recipients,
    payload: {
      title: copy.title,
      body: copy.body,
      preferenceKey: "announcements",
      data: buildPushData({
        type: "announcement_published",
        clubId,
        deepLink,
        webPath,
        preferenceKey: "announcements",
        extra: { announcementId: event.params.announcementId },
      }),
    },
  });
}

function defineEventWrittenTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentWritten(
    {
      document: "clubs/{clubId}/events/{eventId}",
      database: databaseId,
      region: REGION,
    },
    (event) => runWithDatabase(databaseId, () => handleEventWritten(event)),
  );
}

function defineAnnouncementCreatedTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentCreated(
    {
      document: "clubs/{clubId}/announcements/{announcementId}",
      database: databaseId,
      region: REGION,
    },
    (event) =>
      runWithDatabase(databaseId, () => handleAnnouncementCreated(event)),
  );
}

export const onEventWrittenForPush = defineEventWrittenTrigger("v2-prod");
export const onEventWrittenForPushDev = defineEventWrittenTrigger("v2-dev");
export const onAnnouncementCreatedForPush =
  defineAnnouncementCreatedTrigger("v2-prod");
export const onAnnouncementCreatedForPushDev =
  defineAnnouncementCreatedTrigger("v2-dev");

/** Helper exporté pour le scheduler fees (évite cycle). */
export { feesDeepLink, homeDeepLink };
