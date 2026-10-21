import * as admin from "firebase-admin";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import {
  onDocumentCreated,
  onDocumentWrittenWithAuthContext,
  type Change,
  type DocumentSnapshot,
  type FirestoreAuthEvent,
  type FirestoreEvent,
} from "firebase-functions/v2/firestore";
import { stringArray } from "../common";
import { db, runWithDatabase, type FirestoreDatabaseId } from "../db";
import { ClubDirectory, resolveEventAudience } from "./audience";
import {
  announcementPublishedCopy,
  eventCanceledCopy,
  eventCreatedCopy,
  eventPostponedCopy,
} from "./copy";
import { calendarDaysUntil, feesDeepLink, homeDeepLink } from "./deepLinks";
import {
  creationReminderFlags,
  isEventPostponedChange,
  isOnlyPushBookkeepingChange,
  listAddedTeamMemberIds,
  listModifiedEventFields,
  listRsvpStatusChanges,
} from "./eventChange";
import { scheduleEventModifiedNotify } from "./eventModifiedNotify";
import {
  contextForEntry,
  eventPushContext,
  sendEventPushToAudience,
} from "./eventPush";
import { resolveAnnouncementRecipientUids } from "./recipients";
import { scheduleRsvpNotifyDebounce } from "./rsvpNotify";
import { buildPushData, sendPushToUids } from "./send";

const REGION = "europe-west1";

type EventWrittenEvent = FirestoreAuthEvent<
  Change<DocumentSnapshot> | undefined,
  { clubId: string; eventId: string }
>;

type AnnouncementCreatedEvent = FirestoreEvent<
  DocumentSnapshot | undefined,
  { clubId: string; announcementId: string }
>;

/** Uid de l'utilisateur à l'origine de l'écriture (`undefined` si système). */
function actorUid(event: EventWrittenEvent): string | undefined {
  if (
    event.authType === "unknown" ||
    event.authType === "unauthenticated" ||
    event.authType === "service_account" ||
    event.authType === "system"
  ) {
    return undefined;
  }
  return typeof event.authId === "string" && event.authId.trim().length > 0
    ? event.authId.trim()
    : undefined;
}

/**
 * Trigger write event : création (nouvelle convocation) / annulation / report
 * / modification (différée) / RSVP (différé).
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
  const actor = actorUid(event);

  // Création
  if (!before) {
    await handleEventCreated({ firestore, clubId, eventId, eventData: after, actor });
    return;
  }

  if (after.canceled === true && before.canceled !== true) {
    await sendToWholeAudience({
      firestore,
      clubId,
      eventId,
      eventData: after,
      type: "event_canceled",
      actor,
      copy: eventCanceledCopy,
    });
    return;
  }

  if (after.canceled === true) return;

  // Ignore les writes purement techniques (flags push) pour éviter les boucles.
  if (isOnlyPushBookkeepingChange(before, after)) {
    return;
  }

  const addedMemberIds = listAddedTeamMemberIds(before, after);
  if (addedMemberIds.length > 0) {
    await handleAudienceAdded({
      firestore,
      clubId,
      eventId,
      eventData: after,
      addedRosterIds: addedMemberIds,
      actor,
    });
  }

  const rsvpChanges = listRsvpStatusChanges(before, after);
  if (rsvpChanges.length > 0) {
    const actorExclude = String(after.rsvpLastActorUid ?? "").trim() || undefined;
    await scheduleRsvpNotifyDebounce({
      firestore,
      clubId,
      eventId,
      changes: rsvpChanges,
      excludeUid: actor ?? actorExclude,
    });
  }

  if (isEventPostponedChange(before, after)) {
    await sendToWholeAudience({
      firestore,
      clubId,
      eventId,
      eventData: after,
      type: "event_postponed",
      actor,
      copy: eventPostponedCopy,
    });
    // Le calendrier normal reprend pour la nouvelle date ; les rappels dont la
    // fenêtre est déjà passée sont couverts par la push de report.
    await resetReminderFlags({ firestore, clubId, eventId, eventData: after });
    return;
  }

  const modifiedFields = listModifiedEventFields(before, after);
  if (modifiedFields.length > 0) {
    await scheduleEventModifiedNotify({
      firestore,
      clubId,
      eventId,
      fields: modifiedFields,
      excludeUid: actor,
    });
  }
}

/**
 * Nouvelle convocation : seulement si l'event est dans les 7 jours (au-delà,
 * le récap du dimanche et les rappels suffisent) et hors série récurrente
 * (une saison d'entraînements ne doit pas spammer). Les drapeaux de rappel
 * ne sont posés que si la push a bien été envoyée — sinon les crons J-2 / jour J
 * restent disponibles pour les occurrences de série.
 */
async function handleEventCreated(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  eventData: DocumentData;
  actor?: string;
}): Promise<void> {
  if (params.eventData.canceled === true) return;
  // Série : pas de push « nouvelle convocation », et surtout pas de marquage
  // reminderSent* (les crons du soir / matin doivent encore pouvoir relancer).
  if (String(params.eventData.seriesId ?? "").trim().length > 0) return;

  const dateId = String(params.eventData.dateId ?? "").trim();
  if (!dateId) return;

  const daysUntil = calendarDaysUntil({ now: new Date(), eventDateId: dateId });
  const flags = creationReminderFlags(daysUntil);
  if (flags.length === 0) return;

  const directory = new ClubDirectory(params.firestore, params.clubId);
  const entries = await resolveEventAudience(directory, params.eventData);
  const base = eventPushContext(params.eventData);
  await sendEventPushToAudience({
    firestore: params.firestore,
    clubId: params.clubId,
    eventId: params.eventId,
    eventData: params.eventData,
    type: "event_created",
    // Le coach connaît déjà l'event qu'il vient de créer.
    entries: entries.filter((entry) => entry.relation !== "coach"),
    excludeUids: params.actor ? [params.actor] : [],
    copyFor: (entry) => eventCreatedCopy(contextForEntry(base, entry)),
  });

  await params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("events")
    .doc(params.eventId)
    .update(Object.fromEntries(flags.map((flag) => [flag, true])));
}

/**
 * Nouveaux convoqués ajoutés à un event existant (sync roster, rattachement
 * parent…) : même fenêtre et silence séries que la création, push ciblée
 * uniquement aux ids ajoutés (+ parents). Ne repose pas les flags de rappel.
 */
async function handleAudienceAdded(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  eventData: DocumentData;
  addedRosterIds: string[];
  actor?: string;
}): Promise<void> {
  if (params.eventData.canceled === true) return;
  if (String(params.eventData.seriesId ?? "").trim().length > 0) return;

  const dateId = String(params.eventData.dateId ?? "").trim();
  if (!dateId) return;

  const daysUntil = calendarDaysUntil({ now: new Date(), eventDateId: dateId });
  if (creationReminderFlags(daysUntil).length === 0) return;

  const directory = new ClubDirectory(params.firestore, params.clubId);
  const addedMemberIds = new Set<string>();
  for (const rosterId of params.addedRosterIds) {
    addedMemberIds.add((await directory.resolveMemberId(rosterId)) ?? rosterId);
  }

  const entries = (await resolveEventAudience(directory, params.eventData)).filter(
    (entry) =>
      entry.relation !== "coach" &&
      entry.memberId != null &&
      addedMemberIds.has(entry.memberId),
  );
  if (entries.length === 0) return;

  const base = eventPushContext(params.eventData);
  await sendEventPushToAudience({
    firestore: params.firestore,
    clubId: params.clubId,
    eventId: params.eventId,
    eventData: params.eventData,
    type: "event_created",
    entries,
    excludeUids: params.actor ? [params.actor] : [],
    copyFor: (entry) => eventCreatedCopy(contextForEntry(base, entry)),
  });
}

/** Après un report : drapeaux remis à zéro sauf ceux couverts par la push de report. */
async function resetReminderFlags(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  eventData: DocumentData;
}): Promise<void> {
  const dateId = String(params.eventData.dateId ?? "").trim();
  const covered = dateId
    ? creationReminderFlags(calendarDaysUntil({ now: new Date(), eventDateId: dateId }))
    : [];
  const updates: Record<string, unknown> = {};
  for (const flag of ["reminderSentJ7", "reminderSentJ2", "reminderSentDay"] as const) {
    updates[flag] = covered.includes(flag)
      ? true
      : admin.firestore.FieldValue.delete();
  }
  await params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("events")
    .doc(params.eventId)
    .update(updates);
}

/** Push à toute l'audience (joueurs, parents, coachs), sauf l'auteur du changement. */
async function sendToWholeAudience(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  eventData: DocumentData;
  type: string;
  actor?: string;
  copy: (ctx: ReturnType<typeof eventPushContext>) => { title: string; body: string };
}): Promise<void> {
  const directory = new ClubDirectory(params.firestore, params.clubId);
  const entries = await resolveEventAudience(directory, params.eventData);
  const base = eventPushContext(params.eventData);
  await sendEventPushToAudience({
    firestore: params.firestore,
    clubId: params.clubId,
    eventId: params.eventId,
    eventData: params.eventData,
    type: params.type,
    entries,
    excludeUids: params.actor ? [params.actor] : [],
    copyFor: (entry) => params.copy(contextForEntry(base, entry)),
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
  const senderId = String(data.senderId ?? "").trim();
  const clubName = await new ClubDirectory(firestore, clubId).clubName();
  const copy = announcementPublishedCopy({
    clubName,
    message: String(data.message ?? ""),
  });
  const deepLink = homeDeepLink(clubId);
  const webPath = `/home?clubId=${encodeURIComponent(clubId)}`;
  const recipients = await resolveAnnouncementRecipientUids({
    firestore,
    clubId,
    targetType: String(data.targetType ?? "Tous les membres"),
    targetIds: stringArray(data.targetIds),
  });
  await sendPushToUids({
    firestore,
    // L'auteur sait ce qu'il vient de publier.
    uids: recipients.filter((uid) => uid !== senderId),
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
  return onDocumentWrittenWithAuthContext(
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
