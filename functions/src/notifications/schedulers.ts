import type { Firestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, runWithDatabase, type FirestoreDatabaseId } from "../db";
import { ClubDirectory, resolveEventAudience } from "./audience";
import { feeReminderCopy, weeklyDigestCopy } from "./copy";
import {
  addDaysToDateId,
  dateIdToDayMonthLabel,
  dateIdWeekday,
  feesDeepLink,
  memberPlanningDeepLink,
  parisDateId,
  planningDeepLink,
  planningWebPath,
} from "./deepLinks";
import { sendEventPushToAudience } from "./eventPush";
import { resolveFeeRecipientUids } from "./recipients";
import {
  addEventToDigests,
  eveningReminderSlots,
  morningReminderSlots,
  type DigestRecipient,
  type ReminderSlot,
} from "./reminderSlots";
import { flushDueNotifications } from "./rsvpNotify";
import { buildPushData, loadPreferences, sendPushToUids } from "./send";
import { DEFAULT_COACH_SUMMARY_TIMING } from "./types";

const REGION = "europe-west1";
const PARIS = "Europe/Paris";

async function runReminderSlots(slots: ReminderSlot[]): Promise<void> {
  const firestore = db();
  const clubsSnap = await firestore.collection("clubs").select().get();
  for (const clubDoc of clubsSnap.docs) {
    const directory = new ClubDirectory(firestore, clubDoc.id);
    for (const slot of slots) {
      await processClubReminderSlot({ firestore, directory, slot });
    }
  }
}

async function processClubReminderSlot(params: {
  firestore: Firestore;
  directory: ClubDirectory;
  slot: ReminderSlot;
}): Promise<void> {
  const { firestore, directory, slot } = params;
  const eventsSnap = await firestore
    .collection("clubs")
    .doc(directory.clubId)
    .collection("events")
    .where("dateId", "==", slot.dateId)
    .get();

  for (const eventDoc of eventsSnap.docs) {
    const data = eventDoc.data();
    if (data.canceled === true) continue;
    if (data[slot.flag] === true) continue;
    if (!slot.includeEvent(data)) continue;

    const entries = await resolveEventAudience(directory, data);
    const coachPrefs = await loadPreferences(
      firestore,
      entries.filter((entry) => entry.relation === "coach").map((entry) => entry.uid),
    );
    await sendEventPushToAudience({
      firestore,
      clubId: directory.clubId,
      eventId: eventDoc.id,
      eventData: data,
      type: slot.type,
      entries,
      onlyIfDisabled: slot.onlyIfDisabled,
      copyFor: (entry) =>
        slot.copyFor(
          data,
          entry,
          entries,
          coachPrefs.get(entry.uid)?.coachSummaryTiming ??
            DEFAULT_COACH_SUMMARY_TIMING,
        ),
    });
    await eventDoc.ref.update({ [slot.flag]: true });
  }
}

/** Soir 18:30 Europe/Paris, 7 j / 7 : relances, veille des events matinaux, récap du dimanche. */
async function runEveningReminders(): Promise<void> {
  const todayId = parisDateId(new Date());
  await runReminderSlots(eveningReminderSlots(todayId));
  if (dateIdWeekday(todayId) === 0) {
    await runWeeklyDigest(todayId);
  }
}

/** Matin 8:00 Europe/Paris : rappel jour J. */
async function runMorningReminders(): Promise<void> {
  await runReminderSlots(morningReminderSlots(parisDateId(new Date())));
}

/**
 * Récap du dimanche soir : une push par personne pour la semaine du lundi au
 * dimanche suivants, seulement si elle a au moins un event.
 */
async function runWeeklyDigest(todayId: string): Promise<void> {
  const firestore = db();
  const mondayId = addDaysToDateId(todayId, 1);
  const sundayId = addDaysToDateId(todayId, 7);
  const digests = new Map<string, DigestRecipient>();

  const clubsSnap = await firestore.collection("clubs").select().get();
  for (const clubDoc of clubsSnap.docs) {
    const directory = new ClubDirectory(firestore, clubDoc.id);
    const eventsSnap = await firestore
      .collection("clubs")
      .doc(clubDoc.id)
      .collection("events")
      .where("dateId", ">=", mondayId)
      .where("dateId", "<=", sundayId)
      .orderBy("dateId")
      .get();
    for (const eventDoc of eventsSnap.docs) {
      const data = eventDoc.data();
      if (data.canceled === true) continue;
      addEventToDigests({
        digests,
        clubId: clubDoc.id,
        eventData: data,
        entries: await resolveEventAudience(directory, data),
      });
    }
  }

  for (const [uid, digest] of digests) {
    const copy = weeklyDigestCopy(digest.items);
    if (!copy) continue;
    // Un seul club : on ouvre son planning sur le lundi ; sinon le planning perso.
    const singleClubId =
      digest.clubIds.size === 1 ? [...digest.clubIds][0]! : "";
    await sendPushToUids({
      firestore,
      uids: [uid],
      payload: {
        title: copy.title,
        body: copy.body,
        preferenceKey: "weeklyDigest",
        alsoRequire: "events",
        data: buildPushData({
          type: "event_weekly_digest",
          clubId: singleClubId,
          deepLink: singleClubId
            ? planningDeepLink(singleClubId, mondayId)
            : memberPlanningDeepLink(),
          webPath: singleClubId
            ? planningWebPath(singleClubId, mondayId)
            : "/planning",
          preferenceKey: "weeklyDigest",
        }),
      },
    });
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
    if (seasonsSnap.empty) continue;
    const clubName = await new ClubDirectory(firestore, clubDoc.id).clubName();

    for (const seasonDoc of seasonsSnap.docs) {
      const season = seasonDoc.data();
      const seasonLabel = String(season.seasonLabel ?? season.label ?? "");
      const deadline = season.paymentDeadlineAt?.toDate?.() as Date | undefined;
      const overdue = deadline != null && now.getTime() > deadline.getTime();
      const deadlineLabel = deadline
        ? dateIdToDayMonthLabel(parisDateId(deadline))
        : null;
      const copy = feeReminderCopy({
        clubName,
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

function defineEveningReminderSchedule(databaseId: FirestoreDatabaseId) {
  return onSchedule(
    {
      schedule: "30 18 * * *",
      timeZone: PARIS,
      region: REGION,
    },
    async () => runWithDatabase(databaseId, () => runEveningReminders()),
  );
}

function defineMorningReminderSchedule(databaseId: FirestoreDatabaseId) {
  return onSchedule(
    {
      schedule: "0 8 * * *",
      timeZone: PARIS,
      region: REGION,
    },
    async () => runWithDatabase(databaseId, () => runMorningReminders()),
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
 * Toutes les minutes : push RSVP dont le choix est stable depuis le debounce
 * (5 s) et push « modifié » dont le regroupement (10 min, 2 min le jour J) est échu.
 */
function defineRsvpNotifyFlushSchedule(databaseId: FirestoreDatabaseId) {
  return onSchedule(
    {
      schedule: "every 1 minutes",
      timeZone: PARIS,
      region: REGION,
    },
    async () => runWithDatabase(databaseId, () => flushDueNotifications()),
  );
}

export const scheduleEventReminders = defineEveningReminderSchedule("v2-prod");
export const scheduleEventRemindersDev = defineEveningReminderSchedule("v2-dev");
export const scheduleMorningEventReminders =
  defineMorningReminderSchedule("v2-prod");
export const scheduleMorningEventRemindersDev =
  defineMorningReminderSchedule("v2-dev");
export const scheduleFeeReminders = defineFeeReminderSchedule("v2-prod");
export const scheduleFeeRemindersDev = defineFeeReminderSchedule("v2-dev");
export const scheduleRsvpNotifyFlush = defineRsvpNotifyFlushSchedule("v2-prod");
export const scheduleRsvpNotifyFlushDev =
  defineRsvpNotifyFlushSchedule("v2-dev");

/** Exposé pour tests manuels éventuels. */
export {
  runEveningReminders,
  runMorningReminders,
  runWeeklyDigest,
  runFeeReminders,
  flushDueNotifications,
};
