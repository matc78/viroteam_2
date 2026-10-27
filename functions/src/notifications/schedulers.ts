import type {
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, runWithDatabase, type FirestoreDatabaseId } from "../db";
import { ClubDirectory, resolveEventAudience } from "./audience";
import {
  claimScheduledRun,
  clubDirectoryCache,
  clubIdOfEvent,
  isClubEventDoc,
  logScheduledFailure,
} from "./clubEvents";
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
  const directoryFor = clubDirectoryCache(firestore);
  for (const slot of slots) {
    const eventsSnap = await firestore
      .collectionGroup("events")
      .where("dateId", "==", slot.dateId)
      .get();
    for (const eventDoc of eventsSnap.docs.filter(isClubEventDoc)) {
      const clubId = clubIdOfEvent(eventDoc.ref);
      try {
        await processEventReminder({
          firestore,
          directory: directoryFor(clubId),
          slot,
          eventDoc,
        });
      } catch (error) {
        logScheduledFailure("rappel événement", {
          clubId,
          eventId: eventDoc.id,
          type: slot.type,
          error,
        });
      }
    }
  }
}

async function processEventReminder(params: {
  firestore: Firestore;
  directory: ClubDirectory;
  slot: ReminderSlot;
  eventDoc: QueryDocumentSnapshot;
}): Promise<void> {
  const { firestore, directory, slot, eventDoc } = params;
  const data = eventDoc.data();
  if (data.canceled === true) return;
  if (data[slot.flag] === true) return;
  if (!slot.includeEvent(data)) return;

  // Flag posé avant l'envoi (transaction) : un crash ou une double exécution
  // fait au pire manquer ce rappel, jamais l'envoyer deux fois.
  const claimed = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(eventDoc.ref);
    if (!snap.exists || snap.data()?.[slot.flag] === true) return false;
    tx.update(eventDoc.ref, { [slot.flag]: true });
    return true;
  });
  if (!claimed) return;

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
  if (!(await claimScheduledRun(firestore, `weekly_digest_${mondayId}`))) return;
  const digests = new Map<string, DigestRecipient>();
  const directoryFor = clubDirectoryCache(firestore);

  const eventsSnap = await firestore
    .collectionGroup("events")
    .where("dateId", ">=", mondayId)
    .where("dateId", "<=", sundayId)
    .orderBy("dateId")
    .get();
  for (const eventDoc of eventsSnap.docs.filter(isClubEventDoc)) {
    const data = eventDoc.data();
    if (data.canceled === true) continue;
    const clubId = clubIdOfEvent(eventDoc.ref);
    try {
      addEventToDigests({
        digests,
        clubId,
        eventData: data,
        entries: await resolveEventAudience(directoryFor(clubId), data),
      });
    } catch (error) {
      logScheduledFailure("audience du récap hebdo", {
        clubId,
        eventId: eventDoc.id,
        error,
      });
    }
  }

  for (const [uid, digest] of digests) {
    const copy = weeklyDigestCopy(digest.items);
    if (!copy) continue;
    // Un seul club : on ouvre son planning sur le lundi ; sinon le planning perso.
    const singleClubId =
      digest.clubIds.size === 1 ? [...digest.clubIds][0]! : "";
    try {
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
    } catch (error) {
      logScheduledFailure("envoi du récap hebdo", { uid, error });
    }
  }
}

/**
 * Lundi 19:00 Europe/Paris : rappels cotisation.
 */
async function runFeeReminders(): Promise<void> {
  const firestore = db();
  const now = new Date();
  if (!(await claimScheduledRun(firestore, `fee_reminders_${parisDateId(now)}`))) return;
  const directoryFor = clubDirectoryCache(firestore);
  const seasonsSnap = await firestore
    .collectionGroup("fee_seasons")
    .where("isActive", "==", true)
    .get();

  for (const seasonDoc of seasonsSnap.docs) {
    const clubDoc = seasonDoc.ref.parent.parent;
    if (!clubDoc || clubDoc.parent.id !== "clubs") continue;
    try {
      const clubName = await directoryFor(clubDoc.id).clubName();
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
    } catch (error) {
      logScheduledFailure("rappel cotisation", {
        clubId: clubDoc.id,
        seasonId: seasonDoc.id,
        error,
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
      timeoutSeconds: 540,
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
      timeoutSeconds: 540,
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
      timeoutSeconds: 540,
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
