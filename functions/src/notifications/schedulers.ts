import type { Firestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { stringArray } from "../common";
import { db, runWithDatabase, type FirestoreDatabaseId } from "../db";
import {
  eventReminderJ2Copy,
  eventReminderJ7Copy,
  feeReminderCopy,
} from "./copy";
import {
  addDaysToDateId,
  dateIdToIsoDate,
  feesDeepLink,
  parisDateId,
  parisDateLabel,
  planningDeepLink,
} from "./deepLinks";
import {
  resolveEventRecipientUids,
  resolveFeeRecipientUids,
} from "./recipients";
import { flushDueRsvpNotifications } from "./rsvpNotify";
import { buildPushData, sendPushToUids } from "./send";

const REGION = "europe-west1";
const PARIS = "Europe/Paris";

/**
 * Lun–Ven 18:30 Europe/Paris : rappels J-7 et J-2.
 */
async function runEventReminders(): Promise<void> {
  const firestore = db();
  const todayId = parisDateId(new Date());
  const j7DateId = addDaysToDateId(todayId, 7);
  const j2DateId = addDaysToDateId(todayId, 2);

  const clubsSnap = await firestore.collection("clubs").select().get();
  for (const clubDoc of clubsSnap.docs) {
    await processClubEventReminders({
      firestore,
      clubId: clubDoc.id,
      dateId: j7DateId,
      kind: "j7",
    });
    await processClubEventReminders({
      firestore,
      clubId: clubDoc.id,
      dateId: j2DateId,
      kind: "j2",
    });
  }
}

async function processClubEventReminders(params: {
  firestore: Firestore;
  clubId: string;
  dateId: string;
  kind: "j7" | "j2";
}): Promise<void> {
  const eventsSnap = await params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("events")
    .where("dateId", "==", params.dateId)
    .get();

  const flagField =
    params.kind === "j7" ? "reminderSentJ7" : "reminderSentJ2";

  for (const eventDoc of eventsSnap.docs) {
    const data = eventDoc.data();
    if (data.canceled === true) continue;
    if (data[flagField] === true) continue;

    const copy =
      params.kind === "j7"
        ? eventReminderJ7Copy(String(data.title ?? ""))
        : eventReminderJ2Copy(String(data.title ?? ""));
    const deepLink = planningDeepLink(params.clubId, params.dateId);
    const webPath = `/planning?clubId=${encodeURIComponent(params.clubId)}&date=${encodeURIComponent(dateIdToIsoDate(params.dateId))}`;
    const recipients = await resolveEventRecipientUids({
      firestore: params.firestore,
      clubId: params.clubId,
      teamIds: stringArray(data.teamIds),
      teamMemberIds: stringArray(data.teamMemberIds),
    });
    await sendPushToUids({
      firestore: params.firestore,
      uids: recipients,
      payload: {
        title: copy.title,
        body: copy.body,
        preferenceKey: "events",
        data: buildPushData({
          type:
            params.kind === "j7" ? "event_reminder_j7" : "event_reminder_j2",
          clubId: params.clubId,
          deepLink,
          webPath,
          preferenceKey: "events",
          extra: { eventId: eventDoc.id, dateId: params.dateId },
        }),
      },
    });
    await eventDoc.ref.update({ [flagField]: true });
  }
}

/**
 * Lundi 19:00 Europe/Paris : rappels cotisation.
 */
async function runFeeReminders(): Promise<void> {
  const firestore = db();
  const now = new Date();
  const clubsSnap = await firestore.collection("clubs").select().get();

  for (const clubDoc of clubsSnap.docs) {
    const seasonsSnap = await firestore
      .collection("clubs")
      .doc(clubDoc.id)
      .collection("fee_seasons")
      .where("isActive", "==", true)
      .get();

    for (const seasonDoc of seasonsSnap.docs) {
      const season = seasonDoc.data();
      const seasonLabel = String(season.seasonLabel ?? season.label ?? "saison");
      const deadline = season.paymentDeadlineAt?.toDate?.() as Date | undefined;
      const overdue = deadline != null && now.getTime() > deadline.getTime();
      const deadlineLabel = deadline ? parisDateLabel(deadline) : null;
      const copy = feeReminderCopy({
        seasonLabel,
        deadlineLabel,
        overdue,
      });
      const deepLink = feesDeepLink(clubDoc.id);
      const webPath = `/fees?clubId=${encodeURIComponent(clubDoc.id)}`;
      const recipients = await resolveFeeRecipientUids({
        firestore,
        clubId: clubDoc.id,
        seasonId: seasonDoc.id,
      });
      await sendPushToUids({
        firestore,
        uids: recipients,
        payload: {
          title: copy.title,
          body: copy.body,
          preferenceKey: "fees",
          data: buildPushData({
            type: overdue ? "fee_overdue" : "fee_reminder",
            clubId: clubDoc.id,
            deepLink,
            webPath,
            preferenceKey: "fees",
            extra: { seasonId: seasonDoc.id },
          }),
        },
      });
    }
  }
}

function defineEventReminderSchedule(databaseId: FirestoreDatabaseId) {
  return onSchedule(
    {
      schedule: "30 18 * * 1-5",
      timeZone: PARIS,
      region: REGION,
    },
    async () => runWithDatabase(databaseId, () => runEventReminders()),
  );
}

function defineFeeReminderSchedule(databaseId: FirestoreDatabaseId) {
  return onSchedule(
    {
      schedule: "0 19 * * 1",
      timeZone: PARIS,
      region: REGION,
    },
    async () => runWithDatabase(databaseId, () => runFeeReminders()),
  );
}

/**
 * Toutes les minutes : push RSVP dont le choix est stable depuis 1 min.
 */
function defineRsvpNotifyFlushSchedule(databaseId: FirestoreDatabaseId) {
  return onSchedule(
    {
      schedule: "every 1 minutes",
      timeZone: PARIS,
      region: REGION,
    },
    async () => runWithDatabase(databaseId, () => flushDueRsvpNotifications()),
  );
}

export const scheduleEventReminders = defineEventReminderSchedule("v2-prod");
export const scheduleEventRemindersDev = defineEventReminderSchedule("v2-dev");
export const scheduleFeeReminders = defineFeeReminderSchedule("v2-prod");
export const scheduleFeeRemindersDev = defineFeeReminderSchedule("v2-dev");
export const scheduleRsvpNotifyFlush = defineRsvpNotifyFlushSchedule("v2-prod");
export const scheduleRsvpNotifyFlushDev =
  defineRsvpNotifyFlushSchedule("v2-dev");

/** Exposé pour tests manuels éventuels. */
export { runEventReminders, runFeeReminders, flushDueRsvpNotifications };
