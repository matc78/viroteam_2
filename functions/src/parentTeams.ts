import * as admin from "firebase-admin";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import {
  onDocumentWritten,
  type Change,
  type DocumentSnapshot,
  type FirestoreEvent,
} from "firebase-functions/v2/firestore";
import { db, runWithDatabase, type FirestoreDatabaseId } from "./db";
import { stringArray, uniq } from "./common";
import { PER_MEMBER_EVENT_MAPS } from "./eventConvocationsUtils";
import {
  coachIdsOf,
  computeParentTeamIds,
  diffIds,
  isActiveChild,
  playerIdsOf,
  sameIdSet,
  sparringIdsOf,
  type ChildTeams,
} from "./parentTeamsUtils";
import { planSparringMatchChange } from "./teamSparringUtils";
import { updateEachInTransaction } from "./transactions";

export { computeParentTeamIds } from "./parentTeamsUtils";

const GUARDIAN_STATUS_ACTIVE = "active";
const REGION = "europe-west1";

/**
 * Équipes d'une fiche enfant : `members.teamIds` ∪ équipes dont `playerIds`
 * contient la fiche (robuste si `teamIds` n'est pas à jour).
 */
async function childTeamIds(
  firestore: Firestore,
  clubId: string,
  memberId: string,
  member: DocumentData,
): Promise<string[]> {
  const rosterSnap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("teams")
    .where("playerIds", "array-contains", memberId)
    .get();
  return uniq([
    ...stringArray(member.teamIds),
    ...rosterSnap.docs.map((doc) => doc.id),
  ]);
}

/**
 * Recalcule et persiste `users/{parentUid}.parentTeamIds` = union des équipes
 * des fiches enfants dont le lien guardian est `active` (fiches archivées
 * exclues). Ne crée pas le doc user s'il n'existe pas.
 * Retourne la liste calculée.
 */
export async function recomputeParentTeamIds(
  firestore: Firestore,
  parentUid: string,
): Promise<string[]> {
  const guardiansSnap = await firestore
    .collectionGroup("guardians")
    .where("parentUid", "==", parentUid)
    .where("status", "==", GUARDIAN_STATUS_ACTIVE)
    .get();

  const children: ChildTeams[] = [];
  for (const guardianDoc of guardiansSnap.docs) {
    const guardian = guardianDoc.data();
    const memberRef = guardianDoc.ref.parent.parent;
    const clubId =
      String(guardian.clubId ?? "").trim() || memberRef?.parent.parent?.id || "";
    const memberId = String(guardian.memberId ?? "").trim() || memberRef?.id || "";
    if (!clubId || !memberId) continue;

    const memberSnap = await firestore
      .collection("clubs")
      .doc(clubId)
      .collection("members")
      .doc(memberId)
      .get();
    if (!memberSnap.exists) continue;
    const member = memberSnap.data() ?? {};
    if (!isActiveChild(member.status)) continue;

    children.push({
      status: String(member.status ?? "active"),
      teamIds: await childTeamIds(firestore, clubId, memberId, member),
    });
  }

  const parentTeamIds = computeParentTeamIds(children);

  const userRef = firestore.collection("users").doc(parentUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return parentTeamIds;

  const currentRaw = userSnap.data()?.parentTeamIds;
  if (Array.isArray(currentRaw) && sameIdSet(stringArray(currentRaw), parentTeamIds)) {
    return parentTeamIds;
  }

  await userRef.update({
    parentTeamIds,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return parentTeamIds;
}

/** Variante best-effort (log + continue) pour les callables. */
export async function recomputeParentTeamIdsSafe(
  firestore: Firestore,
  parentUid: string,
): Promise<void> {
  try {
    await recomputeParentTeamIds(firestore, parentUid);
  } catch (error) {
    console.error("recomputeParentTeamIds failed", { parentUid, error });
  }
}

/** Uids des guardians actifs d'une fiche. */
export async function activeGuardianUids(
  firestore: Firestore,
  clubId: string,
  memberId: string,
): Promise<string[]> {
  const snap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(memberId)
    .collection("guardians")
    .where("status", "==", GUARDIAN_STATUS_ACTIVE)
    .get();
  return uniq(
    snap.docs.map((doc) => String(doc.data().parentUid ?? doc.id).trim()),
  ).filter((uid) => uid.length > 0);
}

/**
 * Maintient `members.teamIds` (équipes de la fiche, joueur ou coach) et
 * `members.coachTeamIds` (équipes entraînées) depuis les rosters — l'équipe
 * fait foi — pour les fiches dont la présence a changé. Ids de roster = ids
 * de fiche (une seule clé membre). `coachTeamIds` est la relation « coach
 * d'équipe » lue par les règles Firestore et `permissions.ts`.
 *
 * Relit l'équipe courante plutôt que le `after` de l'événement : les
 * déclenchements ne sont pas ordonnés, un événement ancien traité en retard
 * ne doit pas écraser l'état réel.
 */
async function syncMemberTeamIds(params: {
  firestore: Firestore;
  clubId: string;
  teamId: string;
  changedRosterIds: string[];
}): Promise<void> {
  const { firestore, clubId, teamId, changedRosterIds } = params;
  if (changedRosterIds.length === 0) return;
  const clubRef = firestore.collection("clubs").doc(clubId);
  const teamSnap = await clubRef.collection("teams").doc(teamId).get();
  const team = teamSnap.exists ? teamSnap.data() : undefined;
  const remainingCoaches = new Set(coachIdsOf(team));
  const remaining = new Set([...playerIdsOf(team), ...remainingCoaches]);
  const membersCol = clubRef.collection("members");
  const membership = (present: boolean) =>
    present
      ? admin.firestore.FieldValue.arrayUnion(teamId)
      : admin.firestore.FieldValue.arrayRemove(teamId);

  for (const memberId of changedRosterIds) {
    try {
      const memberRef = membersCol.doc(memberId);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) continue;
      const member = memberSnap.data()!;
      const patch: Record<string, unknown> = {};
      const onTeam = remaining.has(memberId);
      if (onTeam !== stringArray(member.teamIds).includes(teamId)) {
        patch.teamIds = membership(onTeam);
      }
      const coachesTeam = remainingCoaches.has(memberId);
      if (coachesTeam !== stringArray(member.coachTeamIds).includes(teamId)) {
        patch.coachTeamIds = membership(coachesTeam);
      }
      if (Object.keys(patch).length > 0) await memberRef.update(patch);
    } catch (error) {
      console.error("onTeamWritten: synchro équipes de la fiche échouée", {
        clubId,
        teamId,
        memberId,
        error,
      });
    }
  }
}

type TeamWrittenEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  { clubId: string; teamId: string }
>;

/**
 * Sur chaque écriture d'équipe : synchronise `members.teamIds`,
 * `members.coachTeamIds` et les
 * convocations des events à venir (joueurs **et** coachs) et des matchs à venir
 * pour les sparrings, puis recalcule `parentTeamIds` des guardians pour les
 * changements de `playerIds` uniquement.
 */
async function handleTeamWritten(event: TeamWrittenEvent): Promise<void> {
  const before = event.data?.before?.exists ? event.data.before.data() : undefined;
  const after = event.data?.after?.exists ? event.data.after.data() : undefined;
  const playerDiff = diffIds(playerIdsOf(before), playerIdsOf(after));
  const coachDiff = diffIds(coachIdsOf(before), coachIdsOf(after));

  const clubId = event.params.clubId;
  const teamId = event.params.teamId;
  const firestore = db();

  const remaining = new Set([...playerIdsOf(after), ...coachIdsOf(after)]);
  const audienceAdded = uniq([...playerDiff.added, ...coachDiff.added]);
  const audienceRemovedRaw = uniq([
    ...playerDiff.removed,
    ...coachDiff.removed,
  ]);
  // Conservé si encore joueur ou coach (passage joueur ↔ coach).
  const audienceRemoved = audienceRemovedRaw.filter((id) => !remaining.has(id));

  await syncMemberTeamIds({
    firestore,
    clubId,
    teamId,
    changedRosterIds: uniq([...audienceAdded, ...audienceRemovedRaw]),
  });

  if (audienceAdded.length > 0 || audienceRemoved.length > 0) {
    await syncUpcomingEventAudienceForRosterChange({
      firestore,
      clubId,
      teamId,
      added: audienceAdded,
      removed: audienceRemoved,
    });
  }

  // Sparrings (sous-ensemble des joueurs restants) : convocations des matchs ;
  // un sparring qui quitte l'effectif voit son exclusion levée.
  const playersAfter = new Set(playerIdsOf(after));
  const sparringsBefore = sparringIdsOf(before);
  const sparringDiff = diffIds(sparringsBefore, sparringIdsOf(after));
  const sparringAdded = sparringDiff.added.filter((id) => playersAfter.has(id));
  const sparringRemoved = sparringDiff.removed.filter((id) => playersAfter.has(id));
  const sparringReleased = sparringsBefore.filter((id) => !playersAfter.has(id));
  if (
    sparringAdded.length > 0 ||
    sparringRemoved.length > 0 ||
    sparringReleased.length > 0
  ) {
    await syncUpcomingMatchesForSparringChange({
      firestore,
      clubId,
      teamId,
      added: sparringAdded,
      removed: sparringRemoved,
      released: sparringReleased,
    });
  }

  // Sync chats équipe / parents (best-effort).
  try {
    const { syncTeamConversations } = await import("./chat/sync");
    await syncTeamConversations({
      firestore,
      clubId,
      teamId,
      teamData: after,
    });
  } catch (error) {
    console.error("syncTeamConversations failed", { clubId, teamId, error });
  }

  const changedPlayers = uniq([...playerDiff.added, ...playerDiff.removed]);
  if (changedPlayers.length === 0) return;

  const parentUids = new Set<string>();

  for (const memberId of changedPlayers) {
    try {
      for (const uid of await activeGuardianUids(firestore, clubId, memberId)) {
        parentUids.add(uid);
      }
    } catch (error) {
      console.error("onTeamWritten: résolution guardians échouée", {
        clubId,
        memberId,
        error,
      });
    }
  }

  for (const parentUid of parentUids) {
    await recomputeParentTeamIdsSafe(firestore, parentUid);
  }
}

/** Début du jour UTC (fenêtre « à venir » côté trigger). */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Ajoute / retire les convocations des events à venir d'une équipe quand le
 * roster (joueurs / coachs) change. Ids = ids de fiche (une seule clé
 * membre). Un retrait efface aussi la réponse, le timestamp et le « vu ».
 * Idempotent.
 */
async function syncUpcomingEventAudienceForRosterChange(params: {
  firestore: Firestore;
  clubId: string;
  teamId: string;
  added: string[];
  removed: string[];
}): Promise<void> {
  const { firestore, clubId, teamId } = params;
  const keysToAdd = new Set<string>(params.added.filter(Boolean));
  const keysToRemove = new Set<string>(
    params.removed.filter((id) => id && !keysToAdd.has(id)),
  );
  if (keysToAdd.size === 0 && keysToRemove.size === 0) return;

  const eventsSnap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("events")
    .where("teamIds", "array-contains", teamId)
    .where("date", ">=", admin.firestore.Timestamp.fromDate(startOfTodayUtc()))
    .get();

  if (eventsSnap.empty) return;

  let batch = firestore.batch();
  let pending = 0;

  for (const eventDoc of eventsSnap.docs) {
    const data = eventDoc.data();
    if (data.canceled === true) continue;

    const members = new Set(stringArray(data.teamMemberIds));
    // Un joueur retiré par le coach n'est jamais reconvoqué par la synchro.
    const excluded = new Set(stringArray(data.excludedMemberIds));
    const nextMembers = new Set(members);
    for (const key of keysToAdd) {
      if (!excluded.has(key)) nextMembers.add(key);
    }
    for (const key of keysToRemove) nextMembers.delete(key);

    const membersChanged =
      nextMembers.size !== members.size ||
      [...nextMembers].some((id) => !members.has(id));

    const patch: Record<string, unknown> = {};
    if (membersChanged) {
      patch.teamMemberIds = [...nextMembers];
    }

    for (const field of PER_MEMBER_EVENT_MAPS) {
      const values = data[field];
      if (!values || typeof values !== "object") continue;
      for (const key of keysToRemove) {
        if (key in values) {
          patch[`${field}.${key}`] = admin.firestore.FieldValue.delete();
        }
      }
    }

    if (Object.keys(patch).length === 0) continue;
    batch.update(eventDoc.ref, patch);
    pending += 1;
    if (pending >= 400) {
      await batch.commit();
      batch = firestore.batch();
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();
}

/**
 * Matchs à venir d'une équipe quand des joueurs passent sparring ([added]),
 * redeviennent joueurs ([removed]) ou quittent l'équipe en étant sparrings
 * ([released]) : voir `planSparringMatchChange`.
 *
 * Les triggers peuvent arriver dans le désordre (bascules rapides) : chaque
 * id est confronté à l'état courant de l'équipe avant d'agir, et chaque match
 * est relu et écrit dans une transaction (pas d'écrasement d'une écriture
 * concurrente). Idempotent.
 */
async function syncUpcomingMatchesForSparringChange(params: {
  firestore: Firestore;
  clubId: string;
  teamId: string;
  added: string[];
  removed: string[];
  released: string[];
}): Promise<void> {
  const { firestore, clubId, teamId } = params;
  const clubRef = firestore.collection("clubs").doc(clubId);
  const teamSnap = await clubRef.collection("teams").doc(teamId).get();
  const team = teamSnap.exists ? teamSnap.data() : undefined;
  const players = new Set(playerIdsOf(team));
  const sparrings = new Set(sparringIdsOf(team));
  const added = params.added.filter((id) => players.has(id) && sparrings.has(id));
  const removed = params.removed.filter((id) => players.has(id) && !sparrings.has(id));
  const released = params.released.filter((id) => !players.has(id));
  if (added.length === 0 && removed.length === 0 && released.length === 0) return;
  const coachIds = coachIdsOf(team);

  const eventsSnap = await clubRef
    .collection("events")
    .where("teamIds", "array-contains", teamId)
    .where("date", ">=", admin.firestore.Timestamp.fromDate(startOfTodayUtc()))
    .get();
  if (eventsSnap.empty) return;

  await updateEachInTransaction(
    firestore,
    eventsSnap.docs.map((doc) => doc.ref),
    (eventData) => {
      const plan = planSparringMatchChange({
        eventData,
        added,
        removed,
        released,
        coachIds,
      });
      if (!plan) return null;
      const patch: Record<string, unknown> = {
        teamMemberIds: plan.teamMemberIds,
        excludedMemberIds: plan.excludedMemberIds,
      };
      for (const path of plan.deletedMapPaths) {
        patch[path] = admin.firestore.FieldValue.delete();
      }
      return patch;
    },
  );
}

/**
 * Les triggers Firestore v2 ne passent pas par `defineDualCallable` : on fixe
 * la base via `runWithDatabase` dans le handler.
 */
function defineTeamWrittenTrigger(databaseId: FirestoreDatabaseId) {
  return onDocumentWritten(
    {
      document: "clubs/{clubId}/teams/{teamId}",
      database: databaseId,
      region: REGION,
    },
    (event) => runWithDatabase(databaseId, () => handleTeamWritten(event)),
  );
}

/** Prod → v2-prod ; `onTeamWrittenDev` → v2-dev. */
export const onTeamWritten = defineTeamWrittenTrigger("v2-prod");
export const onTeamWrittenDev = defineTeamWrittenTrigger("v2-dev");
