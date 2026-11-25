import * as admin from "firebase-admin";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { captureClubEvent, ServerAnalyticsEvents } from "./analytics";
import { requireString, requireUid, stringArray } from "./common";
import { db, defineDualCallable } from "./db";
import { ClubDirectory, resolveEventAudience } from "./notifications/audience";
import { dateIdToShortDayLabel, parisDateId } from "./notifications/deepLinks";
import { eventDateId, sendEventPushToAudience } from "./notifications/eventPush";
import { loadClubAccess, permissionDenied } from "./permissions";
import {
  assertTrainingFeedbackEvent,
  coachDisplayName,
  parseTrainingFeedbackInput,
  TrainingFeedbackError,
  trainingFeedbackPushCopy,
} from "./trainingFeedbackUtils";

/**
 * Envoie le retour de séance d'un coach : notes collectives (niveau de jeu,
 * envie / participation), mot au collectif et messages perso facultatifs.
 *
 * Une partie par coach : `events/{e}/trainingFeedback/{coachUid}` et ses
 * `playerMessages/{memberId}`. Un renvoi remplace la partie du coach (pas de
 * doublon) ; la push ne part qu'au premier envoi. Le brouillon du coach est
 * supprimé. Prod → v2-prod ; `sendTrainingFeedbackDev` → v2-dev.
 */
export const {
  prod: sendTrainingFeedback,
  dev: sendTrainingFeedbackDev,
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

  const [access, eventSnap] = await Promise.all([
    loadClubAccess(clubId, uid),
    eventRef.get(),
  ]);
  if (!eventSnap.exists) {
    throw new HttpsError("not-found", "Entraînement introuvable");
  }
  const event = eventSnap.data()!;
  const teamIds = stringArray(event.teamIds);
  // Seul un coach d'une équipe de la séance fait un retour (l'admin lit).
  if (event.allTeams === true || !access.coachesAnyTeam(teamIds)) {
    throw permissionDenied("Seul un coach de l'équipe peut faire ce retour");
  }

  let input;
  try {
    input = parseTrainingFeedbackInput(request.data);
    assertTrainingFeedbackEvent({
      event,
      todayDateId: parisDateId(new Date()),
      memberIds: input.playerMessages.keys(),
    });
  } catch (error) {
    if (error instanceof TrainingFeedbackError) {
      throw new HttpsError(error.code, error.message);
    }
    throw error;
  }

  const coachName = coachDisplayName(access.member);
  const feedbackRef = eventRef.collection("trainingFeedback").doc(uid);
  const messagesCol = feedbackRef.collection("playerMessages");
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Transaction : deux envois simultanés ne voient pas tous deux « premier
  // envoi » (sinon la push partirait deux fois).
  const alreadySent = await firestore.runTransaction(async (tx) => {
    const [freshEvent, existingMessages] = await Promise.all([
      tx.get(eventRef),
      tx.get(messagesCol.select()),
    ]);
    tx.set(feedbackRef, {
      clubId,
      eventId,
      teamIds,
      coachUid: uid,
      coachName,
      levelRating: input.levelRating,
      engagementRating: input.engagementRating,
      collectiveMessage: input.collectiveMessage,
      playerMessageCount: input.playerMessages.size,
      sentAt: now,
    });
    for (const doc of existingMessages.docs) {
      if (!input.playerMessages.has(doc.id)) tx.delete(doc.ref);
    }
    for (const [memberId, message] of input.playerMessages) {
      tx.set(messagesCol.doc(memberId), {
        clubId,
        eventId,
        coachUid: uid,
        coachName,
        memberId,
        message,
        sentAt: now,
      });
    }
    tx.update(eventRef, {
      trainingFeedbackSentBy: admin.firestore.FieldValue.arrayUnion(uid),
    });
    tx.delete(eventRef.collection("trainingFeedbackDrafts").doc(uid));
    return stringArray(freshEvent.get("trainingFeedbackSentBy")).includes(uid);
  });

  let recipientCount = 0;
  if (!alreadySent) {
    const directory = new ClubDirectory(firestore, clubId);
    const entries = await resolveEventAudience(directory, event);
    const dayLabel = dateIdToShortDayLabel(eventDateId(event));
    const result = await sendEventPushToAudience({
      firestore,
      clubId,
      eventId,
      eventData: event,
      type: "training_feedback",
      entries,
      excludeUids: [uid],
      copyFor: (entry) => {
        if (entry.relation === "coach" || !entry.memberId) return null;
        return trainingFeedbackPushCopy({
          hasMessage: input.playerMessages.has(entry.memberId),
          childFirstName: entry.relation === "guardian" ? entry.childFirstName : undefined,
          dayLabel,
        });
      },
    });
    recipientCount = result.recipientCount;
  }

  await captureClubEvent({
    clubId,
    event: ServerAnalyticsEvents.trainingFeedbackSent,
    properties: {
      player_message_count: input.playerMessages.size,
      has_collective_message: input.collectiveMessage != null,
      resend: alreadySent,
      recipient_count: recipientCount,
    },
  });

  return { ok: true, resend: alreadySent, recipientCount };
});
