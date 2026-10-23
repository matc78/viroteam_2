import * as admin from "firebase-admin";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { captureConvocationSent } from "../analytics";
import { db, defineDualCallable, isProdDatabase } from "../db";
import { requireString, requireUid, stringArray } from "../common";
import { ClubDirectory, resolveEventAudience } from "./audience";
import { eventManualPushCopy } from "./copy";
import {
  contextForEntry,
  eventPushContext,
  sendEventPushToAudience,
} from "./eventPush";
import { canSendManualPush } from "./prefs";
import { MANUAL_PUSH_COOLDOWN_MS } from "./types";

/**
 * Envoi manuel d'une notif event (coach d'une équipe concernée ou admin).
 * Rate-limit 1/heure en prod uniquement (`v2-dev` libre pour le debug).
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

  await assertEventCoachOrAdmin({
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

    if (isProdDatabase()) {
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
    }

    // Claim du slot avant l'envoi pour éviter les doubles concurrentes.
    tx.update(eventRef, {
      lastManualPushAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return data;
  });

  const directory = new ClubDirectory(firestore, clubId);
  const entries = await resolveEventAudience(directory, event);
  // L'expéditeur reçoit aussi la push : c'est sa confirmation d'envoi.
  if (!entries.some((entry) => entry.uid === uid)) {
    entries.push({ uid, relation: "coach", rsvp: "none" });
  }
  const base = eventPushContext(event);

  const result = await sendEventPushToAudience({
    firestore,
    clubId,
    eventId,
    eventData: event,
    type: "event_manual",
    entries,
    copyFor: (entry) => {
      // Qui a déjà dit non n'a pas besoin d'être relancé.
      if (entry.relation !== "coach" && entry.rsvp === "no") return null;
      return eventManualPushCopy({
        ...contextForEntry(base, entry),
        rsvp: entry.relation === "coach" ? "yes" : entry.rsvp,
      });
    },
  });
  await captureConvocationSent(clubId, "manual", result.recipientCount);

  return {
    ok: true,
    recipientCount: result.recipientCount,
    tokenCount: result.tokenCount,
  };
});

/**
 * Admin du club, ou coach d'une des équipes de l'événement ([teamIds]) :
 * sinon `permission-denied`.
 */
export async function assertEventCoachOrAdmin(params: {
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
