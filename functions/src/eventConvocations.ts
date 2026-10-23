import * as admin from "firebase-admin";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db, defineDualCallable } from "./db";
import { requireString, requireUid, stringArray, uniq } from "./common";
import {
  planConvocationChange,
  type ConvocationTarget,
} from "./eventConvocationsUtils";
import { assertEventCoachOrAdmin } from "./notifications/sendEventPush";
import { audienceKeysForRosterId } from "./parentTeams";

/** Garde-fou : un roster d'équipe reste bien en dessous. */
const MAX_IDS_PER_CALL = 200;

/**
 * Retire / réintègre des joueurs convoqués sur un événement (coach des
 * équipes de l'event ou admin). `scope: "following"` applique les mêmes
 * changements aux occurrences suivantes de la série (les passées ne bougent pas).
 * Un retrait n'envoie aucune notif ; la réintégration repasse par le trigger
 * push (« Nouvelle convocation »).
 * Prod → v2-prod ; `updateEventConvocationsDev` → v2-dev.
 */
export const {
  prod: updateEventConvocations,
  dev: updateEventConvocationsDev,
} = defineDualCallable(async (request: CallableRequest) => {
  const uid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const eventId = requireString(request.data?.eventId, "eventId");
  const excludeIds = uniq(stringArray(request.data?.excludeIds));
  const reintegrateIds = uniq(stringArray(request.data?.reintegrateIds));
  const scope = request.data?.scope === "following" ? "following" : "occurrence";

  if (excludeIds.length === 0 && reintegrateIds.length === 0) {
    throw new HttpsError("invalid-argument", "Aucun changement de convocation");
  }
  if (excludeIds.length + reintegrateIds.length > MAX_IDS_PER_CALL) {
    throw new HttpsError("invalid-argument", "Trop de joueurs en une fois");
  }
  if (excludeIds.some((id) => reintegrateIds.includes(id))) {
    throw new HttpsError(
      "invalid-argument",
      "Un joueur ne peut pas être retiré et réintégré à la fois",
    );
  }

  const firestore = db();
  const eventsCol = firestore.collection("clubs").doc(clubId).collection("events");
  const eventSnap = await eventsCol.doc(eventId).get();
  if (!eventSnap.exists) {
    throw new HttpsError("not-found", "Événement introuvable");
  }
  const event = eventSnap.data()!;
  if (event.canceled === true) {
    throw new HttpsError("failed-precondition", "Événement annulé");
  }

  await assertEventCoachOrAdmin({
    clubId,
    uid,
    teamIds: stringArray(event.teamIds),
  });

  const withAliases = async (ids: string[]): Promise<ConvocationTarget[]> =>
    Promise.all(
      ids.map(async (id) => ({
        id,
        aliases: uniq([id, ...(await audienceKeysForRosterId(firestore, clubId, id))]),
      })),
    );
  const exclude = await withAliases(excludeIds);
  const reintegrate = await withAliases(reintegrateIds);

  const targets = [eventSnap];
  const seriesId = String(event.seriesId ?? "").trim();
  const dateId = String(event.dateId ?? "").trim();
  if (scope === "following" && seriesId && dateId) {
    const seriesSnap = await eventsCol.where("seriesId", "==", seriesId).get();
    for (const doc of seriesSnap.docs) {
      if (doc.id === eventId) continue;
      const data = doc.data();
      if (data.canceled === true) continue;
      if (String(data.dateId ?? "") < dateId) continue;
      targets.push(doc);
    }
  }

  let batch = firestore.batch();
  let pending = 0;
  let updatedCount = 0;
  for (const doc of targets) {
    const plan = planConvocationChange({
      eventData: doc.data() ?? {},
      exclude,
      reintegrate,
      isPrimary: doc.id === eventId,
    });
    if (!plan.changed) continue;

    const patch: Record<string, unknown> = {
      teamMemberIds: plan.teamMemberIds,
      excludedMemberIds:
        plan.excludedMemberIds.length > 0
          ? plan.excludedMemberIds
          : admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    for (const path of plan.deletedMapPaths) {
      patch[path] = admin.firestore.FieldValue.delete();
    }
    batch.update(doc.ref, patch);
    pending += 1;
    updatedCount += 1;
    if (pending >= 400) {
      await batch.commit();
      batch = firestore.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();

  return { ok: true, updatedCount };
});
