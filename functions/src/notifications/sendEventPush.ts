import * as admin from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { captureConvocationSent } from "../analytics";
import { db, defineDualCallable, isProdDatabase } from "../db";
import { requireString, requireUid, stringArray } from "../common";
import { loadClubAccess, permissionDenied } from "../permissions";
import { ClubDirectory, resolveEventAudience } from "./audience";
import {
  eventManualPushCopy,
  eventManualPushSentCopy,
} from "./copy";
import {
  contextForEntry,
  eventPushContext,
  sendEventPushToAudience,
} from "./eventPush";
import { canSendManualPush } from "./prefs";
import { MANUAL_PUSH_COOLDOWN_MS } from "./types";

/**
 * Envoi manuel d'une notif event (droit `manageEvents`, ou coach d'une
 * équipe concernée).
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

  await assertCanManageEvent({ clubId, uid, event: preEvent });

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
  const coachFirstName = await resolveCoachFirstName({
    firestore,
    clubId,
    uid,
  });

  const result = await sendEventPushToAudience({
    firestore,
    clubId,
    eventId,
    eventData: event,
    type: "event_manual",
    entries,
    copyFor: (entry) => {
      // Confirmation à l'expéditeur (coach / admin), pas une relance.
      if (entry.uid === uid) {
        return eventManualPushSentCopy(base);
      }
      // Autres coachs : pas de relance manuelle.
      if (entry.relation === "coach") return null;
      // Seulement sans réponse ou « peut-être ».
      if (entry.rsvp !== "none" && entry.rsvp !== "maybe") return null;
      return eventManualPushCopy({
        ...contextForEntry(base, entry),
        rsvp: entry.rsvp,
        coachFirstName,
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
 * Droit `manageEvents`, ou coach de toutes les équipes de l'événement (jamais
 * d'un événement « tout le club ») : sinon `permission-denied`.
 */
export async function assertCanManageEvent(params: {
  clubId: string;
  uid: string;
  event: Record<string, unknown>;
}): Promise<void> {
  const access = await loadClubAccess(params.clubId, params.uid);
  if (access.can("manageEvents")) return;
  const coachAllowed =
    params.event.allTeams !== true &&
    access.coachesAllTeams(stringArray(params.event.teamIds));
  if (!coachAllowed) {
    throw permissionDenied("Réservé aux coachs de l’événement ou aux responsables du planning");
  }
}

/**
 * Prénom du coach / admin expéditeur pour la signature « Signé coach … ».
 * Fiche membre d'abord, puis profil user.
 */
async function resolveCoachFirstName(params: {
  firestore: Firestore;
  clubId: string;
  uid: string;
}): Promise<string> {
  const memberSnap = await params.firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("members")
    .doc(params.uid)
    .get();
  const fromMember = String(memberSnap.data()?.firstName ?? "").trim();
  if (fromMember) return fromMember;

  const userSnap = await params.firestore
    .collection("users")
    .doc(params.uid)
    .get();
  return String(userSnap.data()?.firstName ?? "").trim();
}

function timestampMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const millis = (value as { toMillis?: () => number }).toMillis?.();
    return typeof millis === "number" ? millis : null;
  }
  return null;
}
