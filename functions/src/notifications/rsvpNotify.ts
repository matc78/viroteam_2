import * as admin from "firebase-admin";
import type { DocumentData, Firestore, Timestamp } from "firebase-admin/firestore";
import { stringArray } from "../common";
import { db } from "../db";
import { eventRsvpChangedCopy } from "./copy";
import {
  dateIdToIsoDate,
  parisDateId,
  planningDeepLink,
} from "./deepLinks";
import type { RsvpStatusChange } from "./eventChange";
import {
  memberAccountUid,
  resolveEventRecipientUids,
} from "./recipients";
import { buildPushData, sendPushToUids } from "./send";
import { RSVP_NOTIFY_DEBOUNCE_MS } from "./types";

type RsvpNotifyPendingEntry = {
  version: number;
  status: string;
  dueAt: Timestamp;
  excludeUid?: string;
};

/**
 * Enregistre / reporte le debounce RSVP (1 min) pour chaque membre modifié.
 * Une nouvelle modification du même membre repousse `dueAt` et incrémente `version`.
 */
export async function scheduleRsvpNotifyDebounce(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  changes: RsvpStatusChange[];
  excludeUid?: string;
}): Promise<void> {
  if (params.changes.length === 0) return;

  const eventRef = params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("events")
    .doc(params.eventId);

  const dueAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + RSVP_NOTIFY_DEBOUNCE_MS,
  );
  const excludeUid = params.excludeUid?.trim() || undefined;

  await params.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(eventRef);
    if (!snap.exists) return;
    const data = snap.data() ?? {};
    const pending = readPendingMap(data.rsvpNotifyPending);
    let earliestDueMs: number | null = earliestPendingDueMs(pending);

    for (const change of params.changes) {
      const previous = pending[change.memberId];
      const version = (previous?.version ?? 0) + 1;
      const entry: RsvpNotifyPendingEntry = {
        version,
        status: change.status,
        dueAt,
      };
      if (excludeUid) entry.excludeUid = excludeUid;
      pending[change.memberId] = entry;
      earliestDueMs =
        earliestDueMs == null
          ? dueAt.toMillis()
          : Math.min(earliestDueMs, dueAt.toMillis());
    }

    tx.update(eventRef, {
      rsvpNotifyPending: pending,
      rsvpNotifyDueAt: admin.firestore.Timestamp.fromMillis(
        earliestDueMs ?? dueAt.toMillis(),
      ),
    });
  });
}

/**
 * Envoie les push RSVP dont le debounce est échu et le statut encore stable.
 */
export async function flushDueRsvpNotifications(): Promise<void> {
  const firestore = db();
  const now = admin.firestore.Timestamp.now();
  const clubsSnap = await firestore.collection("clubs").select().get();

  for (const clubDoc of clubsSnap.docs) {
    const eventsSnap = await firestore
      .collection("clubs")
      .doc(clubDoc.id)
      .collection("events")
      .where("rsvpNotifyDueAt", "<=", now)
      .limit(40)
      .get();

    for (const eventDoc of eventsSnap.docs) {
      await flushEventRsvpNotifications({
        firestore,
        clubId: clubDoc.id,
        eventId: eventDoc.id,
        eventData: eventDoc.data(),
        nowMs: now.toMillis(),
      });
    }
  }
}

async function flushEventRsvpNotifications(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  eventData: DocumentData;
  nowMs: number;
}): Promise<void> {
  if (params.eventData.canceled === true) {
    await clearRsvpNotifyBookkeeping(
      params.firestore,
      params.clubId,
      params.eventId,
    );
    return;
  }

  const eventRef = params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("events")
    .doc(params.eventId);

  // Claim transactionnel : évite un double envoi si deux crons se chevauchent.
  const claimed = await params.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(eventRef);
    if (!snap.exists) return [] as Array<{
      memberId: string;
      status: string;
      excludeUid?: string;
    }>;
    const data = snap.data() ?? {};
    if (data.canceled === true) {
      tx.update(eventRef, {
        rsvpNotifyPending: admin.firestore.FieldValue.delete(),
        rsvpNotifyDueAt: admin.firestore.FieldValue.delete(),
      });
      return [];
    }

    const pending = readPendingMap(data.rsvpNotifyPending);
    const rsvpMap = stringMap(data.rsvp);
    const remaining = { ...pending };
    const toSend: Array<{
      memberId: string;
      status: string;
      excludeUid?: string;
    }> = [];

    for (const [memberId, entry] of Object.entries(pending)) {
      if (entry.dueAt.toMillis() > params.nowMs) continue;
      const currentStatus = rsvpMap[memberId] ?? "none";
      delete remaining[memberId];
      if (currentStatus !== entry.status) continue;
      toSend.push({
        memberId,
        status: entry.status,
        ...(entry.excludeUid ? { excludeUid: entry.excludeUid } : {}),
      });
    }

    const earliest = earliestPendingDueMs(remaining);
    if (earliest == null) {
      tx.update(eventRef, {
        rsvpNotifyPending: admin.firestore.FieldValue.delete(),
        rsvpNotifyDueAt: admin.firestore.FieldValue.delete(),
      });
    } else {
      tx.update(eventRef, {
        rsvpNotifyPending: remaining,
        rsvpNotifyDueAt: admin.firestore.Timestamp.fromMillis(earliest),
      });
    }
    return toSend;
  });

  if (claimed.length === 0) return;

  const eventTitle = String(params.eventData.title ?? "");
  const dateId =
    String(params.eventData.dateId ?? "").trim() || parisDateId(new Date());
  const deepLink = planningDeepLink(params.clubId, dateId);
  const webPath = `/planning?clubId=${encodeURIComponent(params.clubId)}&date=${encodeURIComponent(dateIdToIsoDate(dateId))}`;

  const audience = await resolveEventRecipientUids({
    firestore: params.firestore,
    clubId: params.clubId,
    teamIds: stringArray(params.eventData.teamIds),
    teamMemberIds: stringArray(params.eventData.teamMemberIds),
  });

  for (const entry of claimed) {
    const memberName = await resolveMemberDisplayName(
      params.firestore,
      params.clubId,
      entry.memberId,
    );
    const copy = eventRsvpChangedCopy({
      memberName,
      status: entry.status,
      eventTitle,
    });

    const exclude = new Set<string>();
    if (entry.excludeUid) exclude.add(entry.excludeUid);
    const accountUid = await resolveMemberAccountUid(
      params.firestore,
      params.clubId,
      entry.memberId,
    );
    if (accountUid) exclude.add(accountUid);

    const recipients = audience.filter((uid) => !exclude.has(uid));
    if (recipients.length === 0) continue;

    await sendPushToUids({
      firestore: params.firestore,
      uids: recipients,
      payload: {
        title: copy.title,
        body: copy.body,
        preferenceKey: "events",
        data: buildPushData({
          type: "event_rsvp_changed",
          clubId: params.clubId,
          deepLink,
          webPath,
          preferenceKey: "events",
          extra: {
            eventId: params.eventId,
            dateId,
            memberId: entry.memberId,
            rsvp: entry.status,
          },
        }),
      },
    });
  }
}

/**
 * Nom affiché d’un membre club pour le corps de la push RSVP.
 */
async function resolveMemberDisplayName(
  firestore: Firestore,
  clubId: string,
  memberId: string,
): Promise<string> {
  const snap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(memberId)
    .get();
  if (!snap.exists) return "Un membre";
  const data = snap.data()!;
  const composed = [data.firstName, data.lastName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (composed) return composed;
  const displayName = String(data.displayName ?? "").trim();
  return displayName || "Un membre";
}

async function resolveMemberAccountUid(
  firestore: Firestore,
  clubId: string,
  memberId: string,
): Promise<string | null> {
  const snap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(memberId)
    .get();
  if (!snap.exists) {
    const fallback = memberId.trim();
    return fallback.length > 0 ? fallback : null;
  }
  return memberAccountUid(snap.data()!, memberId);
}

function readPendingMap(raw: unknown): Record<string, RsvpNotifyPendingEntry> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, RsvpNotifyPendingEntry> = {};
  for (const [memberId, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    const id = memberId.trim();
    if (!id || !value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const dueAt = entry.dueAt as Timestamp | undefined;
    if (!dueAt || typeof dueAt.toMillis !== "function") continue;
    const version = Number(entry.version ?? 0);
    const status = String(entry.status ?? "none").trim() || "none";
    const excludeUid = String(entry.excludeUid ?? "").trim();
    out[id] = {
      version: Number.isFinite(version) ? version : 0,
      status,
      dueAt,
      ...(excludeUid ? { excludeUid } : {}),
    };
  }
  return out;
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

function earliestPendingDueMs(
  pending: Record<string, RsvpNotifyPendingEntry>,
): number | null {
  let earliest: number | null = null;
  for (const entry of Object.values(pending)) {
    const ms = entry.dueAt.toMillis();
    earliest = earliest == null ? ms : Math.min(earliest, ms);
  }
  return earliest;
}

async function clearRsvpNotifyBookkeeping(
  firestore: Firestore,
  clubId: string,
  eventId: string,
): Promise<void> {
  await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("events")
    .doc(eventId)
    .update({
      rsvpNotifyPending: admin.firestore.FieldValue.delete(),
      rsvpNotifyDueAt: admin.firestore.FieldValue.delete(),
    });
}
