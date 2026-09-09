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
import {
  coachIdsOf,
  computeParentTeamIds,
  diffIds,
  isActiveChild,
  playerIdsOf,
  sameIdSet,
  type ChildTeams,
} from "./parentTeamsUtils";

export { computeParentTeamIds } from "./parentTeamsUtils";

const GUARDIAN_STATUS_ACTIVE = "active";
const REGION = "europe-west1";

/**
 * Identifiants sous lesquels une fiche peut apparaître dans un roster :
 * `memberId`, et `accountUid`/`userId` si le compte est lié (les clients
 * écrivent l'uid du compte dans `playerIds` quand il existe).
 */
function rosterIdsOf(memberId: string, member: DocumentData): string[] {
  return uniq(
    [memberId, member.accountUid, member.userId].filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    ),
  );
}

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
  const teamsCol = firestore.collection("clubs").doc(clubId).collection("teams");
  const rosterSnaps = await Promise.all(
    rosterIdsOf(memberId, member).map((id) =>
      teamsCol.where("playerIds", "array-contains", id).get(),
    ),
  );
  return uniq([
    ...stringArray(member.teamIds),
    ...rosterSnaps.flatMap((snap) => snap.docs.map((doc) => doc.id)),
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

/**
 * Retrouve le `memberId` derrière un identifiant de roster (memberId direct,
 * uid indexé dans `member_accounts`, ou `accountUid` sur la fiche).
 */
async function resolveMemberId(
  firestore: Firestore,
  clubId: string,
  rosterId: string,
): Promise<string | null> {
  const clubRef = firestore.collection("clubs").doc(clubId);
  const direct = await clubRef.collection("members").doc(rosterId).get();
  if (direct.exists) return rosterId;

  const account = await clubRef.collection("member_accounts").doc(rosterId).get();
  const linked = String(account.data()?.memberId ?? "").trim();
  if (account.exists && linked) return linked;

  const byAccount = await clubRef
    .collection("members")
    .where("accountUid", "==", rosterId)
    .limit(1)
    .get();
  return byAccount.docs[0]?.id ?? null;
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

type TeamWrittenEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  { clubId: string; teamId: string }
>;

/**
 * Sur chaque écriture d'équipe : synchronise les convocations des events à
 * venir (joueurs **et** coachs), puis recalcule `parentTeamIds` des guardians
 * pour les changements de `playerIds` uniquement.
 */
async function handleTeamWritten(event: TeamWrittenEvent): Promise<void> {
  const before = event.data?.before?.exists ? event.data.before.data() : undefined;
  const after = event.data?.after?.exists ? event.data.after.data() : undefined;
  const playerDiff = diffIds(playerIdsOf(before), playerIdsOf(after));
  const coachDiff = diffIds(coachIdsOf(before), coachIdsOf(after));

  const clubId = event.params.clubId;
  const teamId = event.params.teamId;
  const firestore = db();

  const audienceAdded = uniq([...playerDiff.added, ...coachDiff.added]);
  const audienceRemovedRaw = uniq([
    ...playerDiff.removed,
    ...coachDiff.removed,
  ]);
  // Conservé si encore joueur ou coach (variantes memberId / accountUid).
  const audienceRemoved = await filterRemovedStillOnTeamRoster({
    firestore,
    clubId,
    remainingRosterIds: uniq([
      ...playerIdsOf(after),
      ...coachIdsOf(after),
    ]),
    removed: audienceRemovedRaw,
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

  const changedPlayers = uniq([...playerDiff.added, ...playerDiff.removed]);
  if (changedPlayers.length === 0) return;

  const parentUids = new Set<string>();

  for (const rosterId of changedPlayers) {
    try {
      const memberId = await resolveMemberId(firestore, clubId, rosterId);
      if (!memberId) continue;
      for (const uid of await activeGuardianUids(firestore, clubId, memberId)) {
        parentUids.add(uid);
      }
    } catch (error) {
      console.error("onTeamWritten: résolution guardians échouée", {
        clubId,
        rosterId,
        error,
      });
    }
  }

  for (const parentUid of parentUids) {
    await recomputeParentTeamIdsSafe(firestore, parentUid);
  }
}

/**
 * Retire de [removed] les ids encore présents sur le roster (joueur ou coach),
 * y compris via une variante d'identifiant (memberId / accountUid).
 */
async function filterRemovedStillOnTeamRoster(params: {
  firestore: Firestore;
  clubId: string;
  remainingRosterIds: string[];
  removed: string[];
}): Promise<string[]> {
  const remaining = new Set(params.remainingRosterIds);
  if (remaining.size === 0) return params.removed;

  const trulyRemoved: string[] = [];
  for (const rosterId of params.removed) {
    const keys = await audienceKeysForRosterId(
      params.firestore,
      params.clubId,
      rosterId,
    );
    if (keys.some((key) => remaining.has(key))) continue;
    trulyRemoved.push(rosterId);
  }
  return trulyRemoved;
}

/**
 * Clés audience / RSVP possibles pour un id roster (memberId, accountUid…).
 */
async function audienceKeysForRosterId(
  firestore: Firestore,
  clubId: string,
  rosterId: string,
): Promise<string[]> {
  const memberId = await resolveMemberId(firestore, clubId, rosterId);
  if (!memberId) return [rosterId];
  const snap = await firestore
    .collection("clubs")
    .doc(clubId)
    .collection("members")
    .doc(memberId)
    .get();
  if (!snap.exists) return uniq([rosterId, memberId]);
  return rosterIdsOf(memberId, snap.data() ?? {});
}

/** Début du jour UTC (fenêtre « à venir » côté trigger). */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Ajoute / retire les convocations des events à venir d'une équipe quand le
 * roster (joueurs / coachs) change. Idempotent. Nettoie aussi les RSVP orphelins.
 */
async function syncUpcomingEventAudienceForRosterChange(params: {
  firestore: Firestore;
  clubId: string;
  teamId: string;
  added: string[];
  removed: string[];
}): Promise<void> {
  const { firestore, clubId, teamId, added, removed } = params;
  if (added.length === 0 && removed.length === 0) return;

  const keysToAdd = new Set<string>();
  for (const rosterId of added) {
    for (const key of await audienceKeysForRosterId(firestore, clubId, rosterId)) {
      keysToAdd.add(key);
    }
  }
  const keysToRemove = new Set<string>();
  for (const rosterId of removed) {
    for (const key of await audienceKeysForRosterId(firestore, clubId, rosterId)) {
      keysToRemove.add(key);
    }
  }
  // Un id encore présent via une autre variante (add) ne doit pas être retiré.
  for (const key of keysToAdd) keysToRemove.delete(key);

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
    const rsvp =
      data.rsvp && typeof data.rsvp === "object"
        ? (data.rsvp as Record<string, unknown>)
        : {};

    const patch: Record<string, unknown> = {};
    const toUnion = [...keysToAdd].filter((key) => !members.has(key));
    const toRemove = [...keysToRemove].filter((key) => members.has(key));

    if (toUnion.length > 0) {
      patch.teamMemberIds = admin.firestore.FieldValue.arrayUnion(...toUnion);
    }
    if (toRemove.length > 0) {
      // arrayUnion + arrayRemove sur le même champ : Firestore les applique
      // séparément ; on ne combine que si un seul opérateur est nécessaire.
      if (toUnion.length > 0) {
        // Deux updates pour éviter un conflit d'opérateurs sur teamMemberIds.
        batch.update(eventDoc.ref, {
          teamMemberIds: admin.firestore.FieldValue.arrayUnion(...toUnion),
        });
        pending += 1;
        if (pending >= 400) {
          await batch.commit();
          batch = firestore.batch();
          pending = 0;
        }
        const rsvpPatch: Record<string, unknown> = {
          teamMemberIds: admin.firestore.FieldValue.arrayRemove(...toRemove),
        };
        for (const key of keysToRemove) {
          if (key in rsvp) {
            rsvpPatch[`rsvp.${key}`] = admin.firestore.FieldValue.delete();
          }
        }
        batch.update(eventDoc.ref, rsvpPatch);
        pending += 1;
        if (pending >= 400) {
          await batch.commit();
          batch = firestore.batch();
          pending = 0;
        }
        continue;
      }
      patch.teamMemberIds = admin.firestore.FieldValue.arrayRemove(...toRemove);
    }

    for (const key of keysToRemove) {
      if (key in rsvp) {
        patch[`rsvp.${key}`] = admin.firestore.FieldValue.delete();
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
