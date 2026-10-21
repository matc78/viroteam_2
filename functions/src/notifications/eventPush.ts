import type { DocumentData, Firestore } from "firebase-admin/firestore";
import type { EventAudienceEntry } from "./audience";
import type { EventPushContext, PushCopy } from "./copy";
import {
  dateIdToShortDayLabel,
  formatTimeFr,
  parisDateId,
  planningDeepLink,
  planningWebPath,
} from "./deepLinks";
import { buildPushData, sendPushToUids } from "./send";
import type { NotificationPreferenceKey } from "./types";

/** dateId d'un event (aujourd'hui Paris si absente). */
export function eventDateId(eventData: DocumentData): string {
  return String(eventData.dateId ?? "").trim() || parisDateId(new Date());
}

/** Contexte de copy d'un event, sans destinataire (pas de prénom d'enfant). */
export function eventPushContext(eventData: DocumentData): EventPushContext {
  return {
    title: String(eventData.title ?? "").trim(),
    type: String(eventData.type ?? "").trim(),
    dayLabel: dateIdToShortDayLabel(eventDateId(eventData)),
    startTime: formatTimeFr(eventData.startTime) || undefined,
    meetingTime: formatTimeFr(eventData.meetingTime) || undefined,
    location: String(eventData.location ?? "").trim() || undefined,
  };
}

/** Contexte de copy pour une entrée d'audience (prénom de l'enfant pour un parent). */
export function contextForEntry(
  base: EventPushContext,
  entry: EventAudienceEntry,
): EventPushContext {
  return entry.relation === "guardian"
    ? { ...base, childFirstName: entry.childFirstName ?? "ton enfant" }
    : base;
}

/**
 * Envoie une push d'event personnalisée par destinataire.
 *
 * [copyFor] renvoie la copy d'une entrée, ou `null` pour ne pas la notifier.
 * Les entrées qui partagent la même copy (et le même enfant pour un parent)
 * partent dans un seul envoi. Le lien ouvre le planning sur l'event, avec
 * l'enfant sélectionné pour un parent.
 */
export async function sendEventPushToAudience(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  eventData: DocumentData;
  type: string;
  entries: EventAudienceEntry[];
  copyFor: (entry: EventAudienceEntry) => PushCopy | null;
  excludeUids?: Iterable<string>;
  preferenceKey?: NotificationPreferenceKey;
  alsoRequire?: NotificationPreferenceKey;
  onlyIfDisabled?: NotificationPreferenceKey;
  extraData?: Record<string, string>;
}): Promise<{ recipientCount: number; tokenCount: number }> {
  const exclude = new Set(params.excludeUids ?? []);
  const dateId = eventDateId(params.eventData);
  const preferenceKey = params.preferenceKey ?? "events";

  const groups = new Map<
    string,
    { copy: PushCopy; forMemberId?: string; uids: Set<string> }
  >();
  const sentKeys = new Set<string>();
  for (const entry of params.entries) {
    if (exclude.has(entry.uid)) continue;
    const forMemberId =
      entry.relation === "guardian" ? entry.memberId : undefined;
    // Une même personne n'est notifiée qu'une fois par sujet (soi / chaque enfant).
    const subjectKey = `${entry.uid}\u0000${forMemberId ?? ""}`;
    if (sentKeys.has(subjectKey)) continue;
    const copy = params.copyFor(entry);
    if (!copy) continue;
    sentKeys.add(subjectKey);

    const groupKey = `${copy.title}\u0000${copy.body}\u0000${forMemberId ?? ""}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = { copy, forMemberId, uids: new Set() };
      groups.set(groupKey, group);
    }
    group.uids.add(entry.uid);
  }

  let recipientCount = 0;
  let tokenCount = 0;
  for (const group of groups.values()) {
    const target = { eventId: params.eventId, memberId: group.forMemberId };
    const extra: Record<string, string> = {
      eventId: params.eventId,
      dateId,
      ...(group.forMemberId ? { forMemberId: group.forMemberId } : {}),
      ...(params.extraData ?? {}),
    };
    const result = await sendPushToUids({
      firestore: params.firestore,
      uids: [...group.uids],
      payload: {
        title: group.copy.title,
        body: group.copy.body,
        preferenceKey,
        alsoRequire: params.alsoRequire,
        onlyIfDisabled: params.onlyIfDisabled,
        data: buildPushData({
          type: params.type,
          clubId: params.clubId,
          deepLink: planningDeepLink(params.clubId, dateId, target),
          webPath: planningWebPath(params.clubId, dateId, target),
          preferenceKey,
          extra,
        }),
      },
    });
    recipientCount += result.recipientCount;
    tokenCount += result.tokenCount;
  }
  return { recipientCount, tokenCount };
}
