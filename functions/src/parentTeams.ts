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
 * Sur chaque écriture d'équipe : pour les joueurs ajoutés/retirés du roster,
 * recalcule `parentTeamIds` de leurs guardians actifs.
 */
async function handleTeamWritten(event: TeamWrittenEvent): Promise<void> {
  const before = event.data?.before?.exists ? event.data.before.data() : undefined;
  const after = event.data?.after?.exists ? event.data.after.data() : undefined;
  const { added, removed } = diffIds(playerIdsOf(before), playerIdsOf(after));
  const changed = uniq([...added, ...removed]);
  if (changed.length === 0) return;

  const clubId = event.params.clubId;
  const firestore = db();
  const parentUids = new Set<string>();

  for (const rosterId of changed) {
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
