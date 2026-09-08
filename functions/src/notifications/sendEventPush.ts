import * as admin from "firebase-admin";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db, defineDualCallable } from "../db";
import { requireString, requireUid, stringArray } from "../common";
import { eventManualPushCopy } from "./copy";
import { dateIdToIsoDate, parisDateLabel, planningDeepLink } from "./deepLinks";
import { canSendManualPush } from "./prefs";
import { resolveEventRecipientUids } from "./recipients";
import { buildPushData, sendPushToUids } from "./send";
import { MANUAL_PUSH_COOLDOWN_MS } from "./types";

/**
 * Envoi manuel d'une notif event (coach d'une équipe concernée ou admin).
 * Rate-limit 1/heure via `lastManualPushAt` (claim atomique en transaction).
 */
export const {
  prod: sendEventPush,
  dev: sendEventPushDev,
} = defineDualCallable(async (request: CallableRequest) => {
  const uid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const eventId = requireString(request.data?.eventId, "eventId");
  const firestore = db();

  const eventRef = firestore
    .collection("clubs")
    .doc(clubId)
    .collection("events")
    .doc(eventId);

  const preSnap = await eventRef.get();
  if (!preSnap.exists) {
    throw new HttpsError("not-found", "Événement introuvable");
  }
  const preEvent = preSnap.data()!;
  if (preEvent.canceled === true) {
    throw new HttpsError("failed-precondition", "Événement annulé");
  }

  await assertCanSendEventPush({
    clubId,
    uid,
    teamIds: stringArray(preEvent.teamIds),
  });

  const event = await firestore.runTransaction(async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists) {
      throw new HttpsError("not-found", "Événement introuvable");
    }
    const data = eventSnap.data()!;
    if (data.canceled === true) {
      throw new HttpsError("failed-precondition", "Événement annulé");
    }

    const lastMs = timestampMillis(data.lastManualPushAt);
    if (
      !canSendManualPush({
        lastManualPushAtMs: lastMs,
        nowMs: Date.now(),
        cooldownMs: MANUAL_PUSH_COOLDOWN_MS,
      })
    ) {
      throw new HttpsError(
        "resource-exhausted",
        "Une notification a déjà été envoyée il y a moins d’une heure",
      );
    }

    // Claim du slot avant l'envoi pour éviter les doubles concurrentes.
    tx.update(eventRef, {
      lastManualPushAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return data;
  });

  const dateId = String(event.dateId ?? "").trim();
  const date =
    event.date?.toDate?.() instanceof Date
      ? (event.date.toDate() as Date)
      : new Date();
  const dateLabel = dateId
    ? parisDateLabel(new Date(`${dateIdToIsoDate(dateId)}T12:00:00`))
    : parisDateLabel(date);
  const copy = eventManualPushCopy({
    title: String(event.title ?? ""),
    dateLabel,
    startTime: String(event.startTime ?? ""),
  });
  const deepLink = planningDeepLink(clubId, dateId || "19700101");
  const webPath = `/planning?clubId=${encodeURIComponent(clubId)}&date=${encodeURIComponent(dateIdToIsoDate(dateId))}`;

  const recipients = await resolveEventRecipientUids({
    firestore,
    clubId,
    teamIds: stringArray(event.teamIds),
    teamMemberIds: stringArray(event.teamMemberIds),
    extraUids: [uid],
  });

  const result = await sendPushToUids({
    firestore,
    uids: recipients,
    payload: {
      title: copy.title,
      body: copy.body,
      preferenceKey: "events",
      data: buildPushData({
        type: "event_manual",
        clubId,
        deepLink,
        webPath,
        preferenceKey: "events",
        extra: {
          eventId,
          dateId,
        },
      }),
    },
  });

  return {
    ok: true,
    recipientCount: result.recipientCount,
    tokenCount: result.tokenCount,
  };
});

async function assertCanSendEventPush(params: {
  clubId: string;
  uid: string;
  teamIds: string[];
}): Promise<void> {
  const firestore = db();
  const clubSnap = await firestore.collection("clubs").doc(params.clubId).get();
  if (!clubSnap.exists) {
    throw new HttpsError("not-found", "Club introuvable");
  }
  const club = clubSnap.data()!;
  const adminIds = Array.isArray(club.adminIds)
    ? club.adminIds.map(String)
    : [];
  if (adminIds.includes(params.uid)) return;

  const accountSnap = await firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("member_accounts")
    .doc(params.uid)
    .get();
  const linkedMemberId = accountSnap.exists
    ? String(accountSnap.data()?.memberId ?? "")
    : params.uid;
  const memberSnap = await firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("members")
    .doc(linkedMemberId)
    .get();
  if (memberSnap.exists && memberSnap.data()?.role === "admin") return;

  if (params.teamIds.length === 0) {
    throw new HttpsError(
      "permission-denied",
      "Réservé aux coaches de l’événement ou aux admins",
    );
  }

  for (const teamId of params.teamIds) {
    const teamSnap = await firestore
      .collection("clubs")
      .doc(params.clubId)
      .collection("teams")
      .doc(teamId)
      .get();
    if (!teamSnap.exists) continue;
    const coachIds = stringArray(teamSnap.data()?.coachIds);
    if (coachIds.includes(params.uid) || coachIds.includes(linkedMemberId)) {
      return;
    }
  }

  throw new HttpsError(
    "permission-denied",
    "Réservé aux coaches de l’événement ou aux admins",
  );
}

function timestampMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const millis = (value as { toMillis?: () => number }).toMillis?.();
    return typeof millis === "number" ? millis : null;
  }
  return null;
}
