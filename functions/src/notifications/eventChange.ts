import type { DocumentData } from "firebase-admin/firestore";
import { stringArray } from "../common";
import type { EventFieldChange } from "./copy";
import { formatTimeFr } from "./deepLinks";
import { DAY_OF_REMINDER_EVE_BEFORE } from "./types";

/** Drapeaux de rappel d'un event (posés par les crons ou à la création). */
export type ReminderFlag = "reminderSentJ7" | "reminderSentJ2" | "reminderSentDay";

/**
 * Rappels à marquer comme envoyés quand l'event est créé (ou reporté) dans
 * leur fenêtre : la push « Nouvelle convocation » / « Changement de date »
 * en tient lieu, inutile d'en remettre une couche le soir même.
 */
export function creationReminderFlags(daysUntil: number): ReminderFlag[] {
  if (daysUntil < 0) return [];
  const flags: ReminderFlag[] = [];
  if (daysUntil <= 7) flags.push("reminderSentJ7");
  if (daysUntil <= 2) flags.push("reminderSentJ2");
  if (daysUntil === 0) flags.push("reminderSentDay");
  return flags;
}

/**
 * `true` si l'event commence assez tôt pour que son rappel du jour J parte
 * la veille au soir plutôt qu'à 8h00 le jour même.
 */
export function dayOfReminderIsEve(startTime: unknown): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(startTime ?? "").trim());
  if (!match) return false;
  const normalized = `${match[1]!.padStart(2, "0")}:${match[2]}`;
  return normalized < DAY_OF_REMINDER_EVE_BEFORE;
}

/** Champs dont le changement déclenche « reporté ». */
export function isEventPostponedChange(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): boolean {
  if (!before) return false;
  return (
    stringifyField(before.dateId) !== stringifyField(after.dateId) ||
    stringifyField(before.startTime) !== stringifyField(after.startTime) ||
    timestampMillis(before.date) !== timestampMillis(after.date)
  );
}

/** Champs suivis pour la push « modifié » (hors report / annulation). */
export const MODIFIED_EVENT_FIELDS = [
  "title",
  "location",
  "meetingLocation",
  "matchVenue",
  "endTime",
  "meetingTime",
  "type",
] as const;

export type ModifiedEventField = (typeof MODIFIED_EVENT_FIELDS)[number];

/** Champs suivis qui ont changé entre before et after. */
export function listModifiedEventFields(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): ModifiedEventField[] {
  if (!before) return [];
  return MODIFIED_EVENT_FIELDS.filter(
    (key) => stringifyField(before[key]) !== stringifyField(after[key]),
  );
}

/** Champs modifiés → descriptions avec la valeur actuelle de l'event. */
export function describeChanges(
  eventData: DocumentData,
  fields: string[],
): EventFieldChange[] {
  const known = new Set<string>(MODIFIED_EVENT_FIELDS);
  const changes: EventFieldChange[] = [];
  for (const field of fields) {
    if (!known.has(field)) continue;
    switch (field as ModifiedEventField) {
      case "location":
        changes.push({ field: "location", value: String(eventData.location ?? "").trim() });
        break;
      case "meetingLocation":
        changes.push({
          field: "meetingLocation",
          value: String(eventData.meetingLocation ?? "").trim(),
        });
        break;
      case "meetingTime":
        changes.push({ field: "meetingTime", value: formatTimeFr(eventData.meetingTime) });
        break;
      case "endTime":
        changes.push({ field: "endTime", value: formatTimeFr(eventData.endTime) });
        break;
      case "title":
        changes.push({ field: "title", value: String(eventData.title ?? "").trim() });
        break;
      case "type":
        changes.push({ field: "type", value: String(eventData.type ?? "").trim() });
        break;
      case "matchVenue":
        changes.push({ field: "matchVenue" });
        break;
    }
  }
  return changes;
}

/**
 * Ids ajoutés à `teamMemberIds` entre before et after (nouveaux convoqués
 * après sync roster / rattachement parent).
 */
export function listAddedTeamMemberIds(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): string[] {
  if (!before) return [];
  const previous = new Set(stringArray(before.teamMemberIds));
  return stringArray(after.teamMemberIds).filter((id) => !previous.has(id));
}

/** Champs dont le changement déclenche « modifié » (hors report / annulation). */
export function isEventContentModified(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): boolean {
  return listModifiedEventFields(before, after).length > 0;
}

/** Entrée RSVP dont le statut a changé entre before et after. */
export type RsvpStatusChange = {
  memberId: string;
  status: string;
};

/**
 * Liste les clés `rsvp` dont la valeur a changé (création / update).
 *
 * Les suppressions de clé (nettoyage audience / roster) sont ignorées : ce ne
 * sont pas des réponses utilisateur et ne doivent pas déclencher de push.
 */
export function listRsvpStatusChanges(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): RsvpStatusChange[] {
  const beforeMap = stringMap(before?.rsvp);
  const afterMap = stringMap(after.rsvp);
  const changes: RsvpStatusChange[] = [];
  for (const memberId of Object.keys(afterMap)) {
    const previous = beforeMap[memberId] ?? "none";
    const next = afterMap[memberId];
    if (previous === next) continue;
    changes.push({ memberId, status: next });
  }
  return changes;
}

/** Champs techniques écrits par les Functions push (jamais par l'utilisateur). */
export const PUSH_BOOKKEEPING_FIELDS = [
  "reminderSentJ7",
  "reminderSentJ2",
  "reminderSentDay",
  "lastManualPushAt",
  "rsvpNotifyPending",
  "rsvpNotifyDueAt",
  "rsvpLastActorUid",
  "modifiedNotifyPending",
  "modifiedNotifyDueAt",
] as const;

/** True si seuls les champs techniques push ont changé. */
export function isOnlyPushBookkeepingChange(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  const bookkeeping = new Set<string>(PUSH_BOOKKEEPING_FIELDS);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (bookkeeping.has(key)) continue;
    if (stringifyField(before[key]) !== stringifyField(after[key])) {
      return false;
    }
  }
  return true;
}

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const memberId = key.trim();
    if (!memberId) continue;
    const status = String(raw ?? "").trim();
    out[memberId] = status.length > 0 ? status : "none";
  }
  return out;
}

function stringifyField(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const millis = (value as { toMillis?: () => number }).toMillis?.();
    return millis != null ? String(millis) : "";
  }
  return JSON.stringify(value);
}

function timestampMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const millis = (value as { toMillis?: () => number }).toMillis?.();
    return typeof millis === "number" ? millis : null;
  }
  if (value instanceof Date) return value.getTime();
  return null;
}
