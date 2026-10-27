import * as admin from "firebase-admin";
import type { DocumentData, Firestore, Timestamp } from "firebase-admin/firestore";
import { db } from "../db";
import {
  ClubDirectory,
  eventStaffUids,
  resolveEventAudience,
  tallyRsvp,
} from "./audience";
import {
  childRsvpConfirmationCopy,
  eventRsvpChangedCopy,
  formatMemberShortName,
} from "./copy";
import type { RsvpStatusChange } from "./eventChange";
import { flushDueEventModifiedNotifications } from "./eventModifiedNotify";
import {
  clubIdOfEvent,
  isClubEventDoc,
  logScheduledFailure,
} from "./clubEvents";
import {
  contextForEntry,
  eventPushContext,
  sendEventPushToAudience,
} from "./eventPush";
import { memberAccountUid } from "./recipients";
import { RSVP_NOTIFY_DEBOUNCE_MS } from "./types";

type RsvpNotifyPendingEntry = {
  version: number;
  status: string;
  dueAt: Timestamp;
  excludeUid?: string;
};

/**
 * Enregistre / reporte le debounce RSVP (5 s) pour chaque membre modifié.
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

  const directory = new ClubDirectory(params.firestore, params.clubId);
  const entries = await resolveEventAudience(directory, params.eventData);
  const staff = new Set(await eventStaffUids(directory, params.eventData));
  const base = eventPushContext(params.eventData);

  const exclude = new Set<string>();
  const responses: Array<{ memberName: string; status: string }> = [];
  const responders = new Map<string, string>();

  for (const entry of claimed) {
    if (entry.excludeUid) exclude.add(entry.excludeUid);
    const memberId =
      (await directory.resolveMemberId(entry.memberId)) ?? entry.memberId;
    const member = await directory.member(memberId);
    // Le joueur qui a répondu n'a pas besoin d'être prévenu de sa réponse.
    exclude.add(member ? (memberAccountUid(member, memberId) ?? memberId) : entry.memberId);
    responders.set(memberId, entry.status);
    responses.push({
      memberName: member
        ? formatMemberShortName({
            firstName: member.firstName as string | undefined,
            lastName: member.lastName as string | undefined,
            displayName: member.displayName as string | undefined,
          })
        : "Un membre",
      status: entry.status,
    });
  }

  const tally = tallyRsvp(entries);
  const digestCopy = eventRsvpChangedCopy({ responses, ctx: base, tally });
  const extra: Record<string, string> = { rsvpCount: String(claimed.length) };
  if (claimed.length === 1) {
    extra.memberId = claimed[0]!.memberId;
    extra.rsvp = claimed[0]!.status;
  }
  const common = {
    firestore: params.firestore,
    clubId: params.clubId,
    eventId: params.eventId,
    eventData: params.eventData,
    type: "event_rsvp_changed",
    excludeUids: exclude,
    preferenceKey: "rsvp" as const,
    extraData: extra,
  };

  // Staff (coachs, ou admins à défaut) : le digest avec le décompte.
  await sendEventPushToAudience({
    ...common,
    entries: [...staff].map((uid) => ({ uid, relation: "coach", rsvp: "none" })),
    copyFor: () => digestCopy,
  });

  // Parents du joueur : confirmation de la réponse posée pour leur enfant.
  await sendEventPushToAudience({
    ...common,
    entries: entries.filter(
      (entry) =>
        entry.relation === "guardian" &&
        entry.memberId != null &&
        responders.has(entry.memberId) &&
        !staff.has(entry.uid),
    ),
    copyFor: (entry) =>
      childRsvpConfirmationCopy({
        ctx: contextForEntry(base, entry),
        status: responders.get(entry.memberId!) ?? "none",
      }),
  });

  // Coéquipiers et autres parents : seulement s'ils l'ont demandé.
  await sendEventPushToAudience({
    ...common,
    entries: entries.filter(
      (entry) =>
        entry.relation !== "coach" &&
        !staff.has(entry.uid) &&
        !(entry.memberId != null && responders.has(entry.memberId)),
    ),
    alsoRequire: "rsvpTeammates",
    copyFor: () => digestCopy,
  });
}

/**
 * Envoie les push RSVP dont le debounce est échu et le statut encore stable,
 * puis les push « modifié » dont le regroupement est échu.
 */
export async function flushDueNotifications(): Promise<void> {
  const firestore = db();
  const now = admin.firestore.Timestamp.now();
  // Une requête collection group par minute (avant : deux par club).
  const eventsSnap = await firestore
    .collectionGroup("events")
    .where("rsvpNotifyDueAt", "<=", now)
    .limit(200)
    .get();

  for (const eventDoc of eventsSnap.docs.filter(isClubEventDoc)) {
    const clubId = clubIdOfEvent(eventDoc.ref);
    try {
      await flushEventRsvpNotifications({
        firestore,
        clubId,
        eventId: eventDoc.id,
        eventData: eventDoc.data(),
        nowMs: now.toMillis(),
      });
    } catch (error) {
      logScheduledFailure("push RSVP", { clubId, eventId: eventDoc.id, error });
    }
  }

  await flushDueEventModifiedNotifications({ firestore, now });
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
