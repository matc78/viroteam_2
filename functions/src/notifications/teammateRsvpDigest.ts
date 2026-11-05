import * as admin from "firebase-admin";
import type {
  DocumentData,
  DocumentReference,
  Firestore,
  Timestamp,
} from "firebase-admin/firestore";
import {
  ClubDirectory,
  resolveEventAudience,
  tallyRsvp,
} from "./audience";
import {
  eventRsvpChangedCopy,
  teammateRsvpDigestCopy,
  type TeammateRsvpDigestItem,
} from "./copy";
import { logScheduledFailure } from "./clubEvents";
import { eventPushContext } from "./eventPush";
import {
  dateIdToShortDayLabel,
  memberPlanningDeepLink,
  parisDateId,
  planningDeepLink,
  planningWebPath,
} from "./deepLinks";
import { buildPushData, sendPushToUids } from "./send";
import { TEAMMATE_RSVP_DIGEST_MS } from "./types";

/** Sous-collection bookkeeping (écritures Admin SDK uniquement). */
export const TEAMMATE_RSVP_DIGEST_COLLECTION = "rsvpTeammateDigests";

export type TeammateDigestQueueItem = {
  responderMemberId: string;
  responderName: string;
  eventId: string;
  dateId: string;
  status: string;
  previousStatus: string;
  eventType: string;
  eventTitle: string;
  tallyYes: number;
  tallyNo: number;
  tallyMaybe: number;
  tallyNone: number;
};

type TeammateDigestDoc = {
  dueAt: Timestamp;
  clubId: string;
  items: Record<string, TeammateDigestQueueItem>;
};

/**
 * Accumule des réponses coéquipiers pour un destinataire (fenêtre 2 min).
 * Une nouvelle entrée repousse `dueAt`.
 */
export async function enqueueTeammateRsvpDigest(params: {
  firestore: Firestore;
  clubId: string;
  recipientUid: string;
  item: TeammateDigestQueueItem;
}): Promise<void> {
  const recipientUid = params.recipientUid.trim();
  if (!recipientUid) return;

  const ref = params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection(TEAMMATE_RSVP_DIGEST_COLLECTION)
    .doc(recipientUid);

  const dueAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + TEAMMATE_RSVP_DIGEST_MS,
  );
  const itemKey = `${params.item.responderMemberId}_${params.item.eventId}`;

  await params.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? (snap.data() as DocumentData) : {};
    const items = readItemsMap(existing.items);
    items[itemKey] = params.item;
    const payload: TeammateDigestDoc = {
      clubId: params.clubId,
      dueAt,
      items,
    };
    tx.set(ref, payload, { merge: true });
  });
}

/**
 * Envoie les digests coéquipiers dont la fenêtre de regroupement est échue.
 */
export async function flushDueTeammateRsvpDigests(params: {
  firestore: Firestore;
  now: admin.firestore.Timestamp;
}): Promise<void> {
  const snap = await params.firestore
    .collectionGroup(TEAMMATE_RSVP_DIGEST_COLLECTION)
    .where("dueAt", "<=", params.now)
    .limit(200)
    .get();

  for (const doc of snap.docs) {
    if (!isTeammateDigestDoc(doc.ref)) continue;
    const clubId = clubIdOfTeammateDigest(doc.ref);
    const recipientUid = doc.id;
    try {
      await flushOneTeammateDigest({
        firestore: params.firestore,
        clubId,
        recipientUid,
        nowMs: params.now.toMillis(),
      });
    } catch (error) {
      logScheduledFailure("push RSVP coéquipiers", {
        clubId,
        recipientUid,
        error,
      });
    }
  }
}

async function flushOneTeammateDigest(params: {
  firestore: Firestore;
  clubId: string;
  recipientUid: string;
  nowMs: number;
}): Promise<void> {
  const ref = params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection(TEAMMATE_RSVP_DIGEST_COLLECTION)
    .doc(params.recipientUid);

  const claimed = await params.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null as TeammateDigestDoc | null;
    const data = snap.data() as DocumentData;
    const dueAt = data.dueAt as Timestamp | undefined;
    if (!dueAt || typeof dueAt.toMillis !== "function") {
      tx.delete(ref);
      return null;
    }
    if (dueAt.toMillis() > params.nowMs) return null;
    const items = readItemsMap(data.items);
    tx.delete(ref);
    if (Object.keys(items).length === 0) return null;
    return {
      dueAt,
      clubId: params.clubId,
      items,
    };
  });

  if (!claimed) return;

  const itemList = Object.values(claimed.items);
  const digestItems: TeammateRsvpDigestItem[] = itemList.map((item) => ({
    responderMemberId: item.responderMemberId,
    responderName: item.responderName,
    eventId: item.eventId,
    status: item.status,
    previousStatus: item.previousStatus,
  }));

  const singleEventCopy =
    itemList.length === 1
      ? eventRsvpChangedCopy({
          responses: [
            {
              memberName: itemList[0]!.responderName,
              status: itemList[0]!.status,
              previousStatus: itemList[0]!.previousStatus,
            },
          ],
          ctx: {
            title: itemList[0]!.eventTitle,
            type: itemList[0]!.eventType,
            dayLabel: dateIdToShortDayLabel(itemList[0]!.dateId),
          },
          tally: {
            yes: itemList[0]!.tallyYes,
            no: itemList[0]!.tallyNo,
            maybe: itemList[0]!.tallyMaybe,
            none: itemList[0]!.tallyNone,
          },
        })
      : undefined;

  const copy = teammateRsvpDigestCopy({
    items: digestItems,
    singleEventCopy,
  });

  const multiEvent = new Set(itemList.map((item) => item.eventId)).size > 1;
  const primary = itemList[0]!;
  const dateId = primary.dateId || parisDateId(new Date());
  const deepLink = multiEvent
    ? memberPlanningDeepLink()
    : planningDeepLink(params.clubId, dateId, { eventId: primary.eventId });
  const webPath = multiEvent
    ? "/planning"
    : planningWebPath(params.clubId, dateId, { eventId: primary.eventId });

  const extra: Record<string, string> = {
    rsvpCount: String(itemList.length),
    teammateDigest: "1",
  };
  if (!multiEvent) {
    extra.eventId = primary.eventId;
    extra.dateId = dateId;
    if (itemList.length === 1) {
      extra.memberId = primary.responderMemberId;
      extra.rsvp = primary.status;
    }
  }

  await sendPushToUids({
    firestore: params.firestore,
    uids: [params.recipientUid],
    payload: {
      title: copy.title,
      body: copy.body,
      preferenceKey: "rsvp",
      alsoRequire: "rsvpTeammates",
      data: buildPushData({
        type: "event_rsvp_changed",
        clubId: params.clubId,
        deepLink,
        webPath,
        preferenceKey: "rsvp",
        extra,
      }),
    },
  });
}

/**
 * Construit les items de file pour les réponses claimées d’un event, puis
 * les enqueu pour chaque destinataire coéquipier (hors staff / répondants).
 */
export async function enqueueTeammateDigestsForEvent(params: {
  firestore: Firestore;
  clubId: string;
  eventId: string;
  eventData: DocumentData;
  claimed: Array<{
    memberId: string;
    status: string;
    previousStatus: string;
  }>;
  recipientUids: string[];
  responderNames: Map<string, string>;
}): Promise<void> {
  if (params.claimed.length === 0 || params.recipientUids.length === 0) {
    return;
  }

  const directory = new ClubDirectory(params.firestore, params.clubId);
  const entries = await resolveEventAudience(directory, params.eventData);
  const tally = tallyRsvp(entries);
  const ctx = eventPushContext(params.eventData);
  const dateId =
    String(params.eventData.dateId ?? "").trim() || parisDateId(new Date());

  const items: TeammateDigestQueueItem[] = [];
  for (const entry of params.claimed) {
    const memberId =
      (await directory.resolveMemberId(entry.memberId)) ?? entry.memberId;
    items.push({
      responderMemberId: memberId,
      responderName: params.responderNames.get(memberId) ?? "Un membre",
      eventId: params.eventId,
      dateId,
      status: entry.status,
      previousStatus: entry.previousStatus,
      eventType: ctx.type,
      eventTitle: ctx.title,
      tallyYes: tally.yes,
      tallyNo: tally.no,
      tallyMaybe: tally.maybe,
      tallyNone: tally.none,
    });
  }

  await Promise.all(
    params.recipientUids.flatMap((uid) =>
      items.map((item) =>
        enqueueTeammateRsvpDigest({
          firestore: params.firestore,
          clubId: params.clubId,
          recipientUid: uid,
          item,
        }),
      ),
    ),
  );
}

function readItemsMap(raw: unknown): Record<string, TeammateDigestQueueItem> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, TeammateDigestQueueItem> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || !value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const responderMemberId = String(entry.responderMemberId ?? "").trim();
    const eventId = String(entry.eventId ?? "").trim();
    if (!responderMemberId || !eventId) continue;
    out[key] = {
      responderMemberId,
      responderName:
        String(entry.responderName ?? "Un membre").trim() || "Un membre",
      eventId,
      dateId: String(entry.dateId ?? "").trim(),
      status: String(entry.status ?? "none").trim() || "none",
      previousStatus: String(entry.previousStatus ?? "none").trim() || "none",
      eventType: String(entry.eventType ?? "").trim(),
      eventTitle: String(entry.eventTitle ?? "").trim(),
      tallyYes: Number(entry.tallyYes ?? 0) || 0,
      tallyNo: Number(entry.tallyNo ?? 0) || 0,
      tallyMaybe: Number(entry.tallyMaybe ?? 0) || 0,
      tallyNone: Number(entry.tallyNone ?? 0) || 0,
    };
  }
  return out;
}

/** Vrai pour `clubs/{clubId}/rsvpTeammateDigests/{uid}`. */
function isTeammateDigestDoc(ref: DocumentReference): boolean {
  const parts = ref.path.split("/");
  return (
    parts.length === 4 &&
    parts[0] === "clubs" &&
    parts[2] === TEAMMATE_RSVP_DIGEST_COLLECTION
  );
}

function clubIdOfTeammateDigest(ref: DocumentReference): string {
  return ref.path.split("/")[1] ?? "";
}
