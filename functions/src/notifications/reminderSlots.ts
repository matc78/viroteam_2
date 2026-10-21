import type { DocumentData } from "firebase-admin/firestore";
import { tallyRsvp, type EventAudienceEntry } from "./audience";
import {
  eventCoachJ2SummaryCopy,
  eventDayOfReminderCopy,
  eventReminderJ2Copy,
  eventReminderJ2MaybeCopy,
  eventReminderJ7Copy,
  eventReminderJ7MaybeCopy,
  type PushCopy,
  type WeeklyDigestItem,
} from "./copy";
import {
  addDaysToDateId,
  dateIdToShortDayLabel,
  dateIdWeekday,
} from "./deepLinks";
import { dayOfReminderIsEve, type ReminderFlag } from "./eventChange";
import { contextForEntry, eventPushContext } from "./eventPush";
import type { NotificationPreferenceKey } from "./types";

/**
 * Calendrier des rappels d'events et récap hebdo : logique pure (sans
 * Firestore), exécutée par les crons de `schedulers.ts`.
 */

/** Un créneau de rappel : quels events, quel drapeau, qui et avec quel texte. */
export type ReminderSlot = {
  dateId: string;
  flag: ReminderFlag;
  type: string;
  /** Filtre sur les events du jour visé (ex. events importants, matinaux). */
  includeEvent: (eventData: DocumentData) => boolean;
  /**
   * Copy d'un destinataire, `null` pour ne pas le notifier.
   * [allEntries] sert au bilan coach (décompte RSVP).
   */
  copyFor: (
    eventData: DocumentData,
    entry: EventAudienceEntry,
    allEntries: EventAudienceEntry[],
  ) => PushCopy | null;
  /** Le dimanche, J-7 / J-2 ne partent qu'à ceux qui ont coupé le récap. */
  onlyIfDisabled?: NotificationPreferenceKey;
};

/**
 * Relance « tu viens ? » : convoqués (et parents) sans réponse ou en
 * « peut-être ».
 */
function pendingResponseOnly(
  buildNone: (ctx: ReturnType<typeof contextForEntry>) => PushCopy,
  buildMaybe: (ctx: ReturnType<typeof contextForEntry>) => PushCopy,
) {
  return (
    eventData: DocumentData,
    entry: EventAudienceEntry,
    _allEntries: EventAudienceEntry[],
  ): PushCopy | null => {
    if (entry.relation === "coach") return null;
    if (entry.rsvp !== "none" && entry.rsvp !== "maybe") return null;
    const ctx = contextForEntry(eventPushContext(eventData), entry);
    return entry.rsvp === "maybe" ? buildMaybe(ctx) : buildNone(ctx);
  };
}

/**
 * J-2 : relance aux sans-réponse / peut-être, et bilan (décompte) aux coachs.
 */
function j2CopyFor(
  eventData: DocumentData,
  entry: EventAudienceEntry,
  allEntries: EventAudienceEntry[],
): PushCopy | null {
  if (entry.relation === "coach") {
    return eventCoachJ2SummaryCopy({
      ...eventPushContext(eventData),
      tally: tallyRsvp(allEntries),
    });
  }
  if (entry.rsvp !== "none" && entry.rsvp !== "maybe") return null;
  const ctx = contextForEntry(eventPushContext(eventData), entry);
  return entry.rsvp === "maybe"
    ? eventReminderJ2MaybeCopy(ctx)
    : eventReminderJ2Copy(ctx);
}

/** Jour J : ceux qui viennent, hésitent ou n'ont pas répondu, et les coachs. */
function dayOfCopy(when: "today" | "tomorrow") {
  return (
    eventData: DocumentData,
    entry: EventAudienceEntry,
    _allEntries: EventAudienceEntry[],
  ): PushCopy | null => {
    if (entry.rsvp === "no") return null;
    return eventDayOfReminderCopy({
      ...contextForEntry(eventPushContext(eventData), entry),
      when,
      // Un coach n'a pas de réponse à donner.
      rsvp: entry.relation === "coach" ? "yes" : entry.rsvp,
    });
  };
}

/**
 * Créneaux du soir (18:30) pour la date Paris [todayId] :
 * - J-2 pour tous les events (sans-réponse / peut-être + bilan coach) ;
 * - J-7 pour les events marqués importants, aux sans-réponse / peut-être ;
 * - veille au soir du rappel jour J pour les events qui commencent avant 10h.
 *
 * Le dimanche, le récap couvre J-2 (mardi) et J-7 (dimanche suivant) : ces
 * relances ne partent qu'à ceux qui ont coupé le récap.
 */
export function eveningReminderSlots(todayId: string): ReminderSlot[] {
  const sunday = dateIdWeekday(todayId) === 0;
  const onlyIfDisabled: NotificationPreferenceKey | undefined = sunday
    ? "weeklyDigest"
    : undefined;
  return [
    {
      dateId: addDaysToDateId(todayId, 2),
      flag: "reminderSentJ2",
      type: "event_reminder_j2",
      includeEvent: () => true,
      copyFor: j2CopyFor,
      onlyIfDisabled,
    },
    {
      dateId: addDaysToDateId(todayId, 7),
      flag: "reminderSentJ7",
      type: "event_reminder_j7",
      includeEvent: (eventData) => eventData.importantReminder === true,
      copyFor: pendingResponseOnly(eventReminderJ7Copy, eventReminderJ7MaybeCopy),
      onlyIfDisabled,
    },
    {
      dateId: addDaysToDateId(todayId, 1),
      flag: "reminderSentDay",
      type: "event_reminder_day",
      includeEvent: (eventData) => dayOfReminderIsEve(eventData.startTime),
      copyFor: dayOfCopy("tomorrow"),
    },
  ];
}

/** Créneau du matin (8:00) : rappel jour J des events qui commencent à 10h ou plus tard. */
export function morningReminderSlots(todayId: string): ReminderSlot[] {
  return [
    {
      dateId: todayId,
      flag: "reminderSentDay",
      type: "event_reminder_day",
      includeEvent: (eventData) => !dayOfReminderIsEve(eventData.startTime),
      copyFor: dayOfCopy("today"),
    },
  ];
}

/** Programme de la semaine d'une personne, tous clubs et enfants confondus. */
export type DigestRecipient = { items: WeeklyDigestItem[]; clubIds: Set<string> };

/**
 * Agrège les entrées d'audience d'un event dans les récaps par uid. Un
 * convoqué qui a dit non n'y voit pas l'event ; un parent voit chaque enfant.
 */
export function addEventToDigests(params: {
  digests: Map<string, DigestRecipient>;
  clubId: string;
  eventData: DocumentData;
  entries: EventAudienceEntry[];
}): void {
  const dayLabel = dateIdToShortDayLabel(String(params.eventData.dateId ?? ""));
  const type = String(params.eventData.type ?? "");
  const seen = new Set<string>();
  for (const entry of params.entries) {
    if (entry.rsvp === "no" && entry.relation !== "coach") continue;
    const key = `${entry.uid}\u0000${entry.memberId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let digest = params.digests.get(entry.uid);
    if (!digest) {
      digest = { items: [], clubIds: new Set() };
      params.digests.set(entry.uid, digest);
    }
    digest.clubIds.add(params.clubId);
    digest.items.push({
      type,
      dayLabel,
      awaitingResponse: entry.relation !== "coach" && entry.rsvp === "none",
    });
  }
}
