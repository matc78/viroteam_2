/**
 * Re-keying d'une fiche membre sur l'uid de son compte (I/O Firestore).
 *
 * N'importe pas `db.ts` : la base est passée en paramètre, pour que
 * `tool/rekey_linked_members.mjs` réutilise ce module tel quel.
 * Décision et invariant : voir `memberRekeyPlan.ts`.
 */
import {
  FieldPath,
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  type Transaction,
} from "firebase-admin/firestore";
import { migrateTeamMemberIds } from "./eventAudienceMigrate";
import { TEAM_ROSTER_FIELDS, accountUidOf, stringArray } from "./common";
import { adminIdsUpdate } from "./permissionsCatalog";
import {
  ANNOUNCEMENT_TARGET_PEOPLE,
  buildEventRekeyPatch,
  buildTeamRekeyPatch,
  feeMoveDecision,
  mergeMemberDocs,
  rewriteParentLinks,
  type FeeState,
} from "./memberRekeyPlan";
import { SILENT_WRITE_FIELD } from "./notifications/silentWrite";

const EVENTS_PAGE_SIZE = 500;
const BATCH_SIZE = 400;
const EVENT_REKEY_FIELDS = [
  "teamMemberIds",
  "excludedMemberIds",
  "rsvp",
  "rsvpUpdatedAt",
  "seenAt",
  "attendance",
];

/** Re-keying impossible sans décision humaine (ou fiche absente). */
export class MemberRekeyError extends Error {
  constructor(
    readonly code: "source-missing" | "account-conflict" | "collision",
    message: string,
  ) {
    super(message);
  }
}

/** Lectures du cœur transactionnel (toutes faites avant la moindre écriture). */
export type RekeyCoreState = {
  clubId: string;
  fromMemberId: string;
  uid: string;
  clubRef: DocumentReference;
  sourceRef: DocumentReference;
  targetRef: DocumentReference;
  club: DocumentSnapshot;
  source: DocumentSnapshot;
  target: DocumentSnapshot;
  sourceGuardians: QueryDocumentSnapshot[];
  targetGuardianIds: Set<string>;
  parents: DocumentSnapshot[];
};

/** Issue du cœur : fiche déplacée, fusionnée avec une fiche existante, ou déjà faite. */
export type RekeyCoreOutcome = "done" | "merged" | "already";

/** Compteurs de la réécriture des références. */
export type RekeyReferencesReport = {
  teams: number;
  events: number;
  announcements: number;
  invitations: number;
  paymentSessions: number;
  feesMoved: number;
  feesDropped: number;
  /** Saisons où deux cotisations non vides coexistent (un admin tranche). */
  feeConflictSeasonIds: string[];
};

/** Rapport complet d'un re-keying. */
export type RekeyReport = {
  core: RekeyCoreOutcome | "skipped";
  skippedReason?: MemberRekeyError["code"];
  references?: RekeyReferencesReport;
};

/** Ids précédents d'une fiche (`formerMemberIds`). */
export function formerMemberIdsOf(data: DocumentData | undefined): string[] {
  return stringArray(data?.formerMemberIds);
}

/**
 * Lit (dans [tx]) tout ce qu'il faut pour re-keyer `members/{fromMemberId}`
 * vers `members/{uid}` : fiches, guardians des deux côtés, parents, club.
 */
export async function readRekeyCore(
  tx: Transaction,
  params: { firestore: Firestore; clubId: string; fromMemberId: string; uid: string },
): Promise<RekeyCoreState> {
  const { firestore, clubId, fromMemberId, uid } = params;
  const clubRef = firestore.collection("clubs").doc(clubId);
  const sourceRef = clubRef.collection("members").doc(fromMemberId);
  const targetRef = clubRef.collection("members").doc(uid);
  const [club, source, target] = await tx.getAll(clubRef, sourceRef, targetRef);
  const [sourceGuardiansSnap, targetGuardiansSnap] = await Promise.all([
    tx.get(sourceRef.collection("guardians")),
    tx.get(targetRef.collection("guardians")),
  ]);
  const parentRefs = sourceGuardiansSnap.docs.map((doc) =>
    firestore.collection("users").doc(doc.id),
  );
  const parents = parentRefs.length > 0 ? await tx.getAll(...parentRefs) : [];
  return {
    clubId,
    fromMemberId,
    uid,
    clubRef,
    sourceRef,
    targetRef,
    club,
    source,
    target,
    sourceGuardians: sourceGuardiansSnap.docs,
    targetGuardianIds: new Set(targetGuardiansSnap.docs.map((doc) => doc.id)),
    parents,
  };
}

/**
 * Écrit (dans [tx]) la fiche sous `members/{uid}`, déplace ses guardians,
 * réécrit `parentLinks` et `club.adminIds`, supprime l'ancienne fiche.
 * [extraFields] (valeurs simples, pas de `FieldValue.delete`) complète la
 * fiche, ex. le profil lors d'une acceptation d'invitation.
 * Lève [MemberRekeyError] si la fiche est liée à un autre compte, ou si une
 * fiche existe déjà à l'uid sans [mergeDuplicates].
 */
export function writeRekeyCore(
  tx: Transaction,
  state: RekeyCoreState,
  options: { extraFields?: Record<string, unknown>; mergeDuplicates?: boolean } = {},
): RekeyCoreOutcome {
  const { clubId, fromMemberId: from, uid } = state;
  if (!state.source.exists) {
    if (formerMemberIdsOf(state.target.data()).includes(from)) return "already";
    throw new MemberRekeyError("source-missing", "Fiche membre introuvable");
  }
  const sourceData = state.source.data()!;
  const targetData = state.target.exists ? state.target.data()! : null;
  for (const linked of [accountUidOf(sourceData), accountUidOf(targetData)]) {
    if (linked && linked !== uid) {
      throw new MemberRekeyError(
        "account-conflict",
        "Cette fiche est déjà liée à un autre compte",
      );
    }
  }
  if (targetData && !options.mergeDuplicates) {
    throw new MemberRekeyError(
      "collision",
      "Une autre fiche existe déjà pour ce compte",
    );
  }

  const base = targetData ? mergeMemberDocs(sourceData, targetData) : { ...sourceData };
  delete base.activeInvitationId;
  // Champs v1 : la clé est l'id du doc, le compte est `accountUid`, les
  // droits sont `permissions` (plus de rôle ni de `coachInfo`).
  delete base.memberId;
  delete base.userId;
  delete base.role;
  delete base.coachInfo;
  tx.set(state.targetRef, {
    ...base,
    ...options.extraFields,
    accountUid: uid,
    formerMemberIds: [...new Set([...formerMemberIdsOf(base), from])],
    rekeyPendingFrom: from,
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (const guardian of state.sourceGuardians) {
    if (!state.targetGuardianIds.has(guardian.id)) {
      tx.set(state.targetRef.collection("guardians").doc(guardian.id), {
        ...guardian.data(),
        memberId: uid,
      });
    }
    tx.delete(guardian.ref);
  }
  for (const parent of state.parents) {
    const nextLinks = rewriteParentLinks(parent.get("parentLinks"), clubId, from, uid);
    if (nextLinks) tx.update(parent.ref, { parentLinks: nextLinks });
  }

  tx.delete(state.sourceRef);

  const clubData = state.club.data() ?? {};
  const clubPatch: Record<string, unknown> = {};
  // La fiche devient liée : elle entre dans l'index des admins si elle porte
  // le droit Administrateur (une fiche non liée n'y figure jamais).
  const nextAdminIds = adminIdsUpdate({
    adminIds: stringArray(clubData.adminIds),
    memberId: uid,
    linked: true,
    permissions: base.permissions,
    formerMemberIds: [from],
  });
  if (nextAdminIds) clubPatch.adminIds = nextAdminIds;
  if (targetData) {
    clubPatch.memberCount = Math.max(0, Number(clubData.memberCount ?? 0) - 1);
  }
  if (state.club.exists && Object.keys(clubPatch).length > 0) {
    tx.update(state.clubRef, {
      ...clubPatch,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  return targetData ? "merged" : "done";
}

/** Applique [updates] par lots (sous la limite de 500 écritures par batch). */
async function commitUpdates(
  firestore: Firestore,
  updates: Array<[DocumentReference, Record<string, unknown>]>,
): Promise<void> {
  for (let start = 0; start < updates.length; start += BATCH_SIZE) {
    const batch = firestore.batch();
    for (const [ref, patch] of updates.slice(start, start + BATCH_SIZE)) {
      batch.update(ref, patch);
    }
    await batch.commit();
  }
}

/** Transactions menées en parallèle par [updateEachInTransaction]. */
const TRANSACTION_CONCURRENCY = 10;

/**
 * Pour chaque document de [refs] : relit dans une transaction, recalcule le
 * patch avec [buildPatch] sur la donnée fraîche, l'applique s'il n'est pas
 * `null`. Retourne le nombre de documents modifiés.
 */
async function updateEachInTransaction(
  firestore: Firestore,
  refs: DocumentReference[],
  buildPatch: (data: DocumentData) => Record<string, unknown> | null,
): Promise<number> {
  let updated = 0;
  for (let start = 0; start < refs.length; start += TRANSACTION_CONCURRENCY) {
    const results = await Promise.all(
      refs.slice(start, start + TRANSACTION_CONCURRENCY).map((ref) =>
        firestore.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return false;
          const patch = buildPatch(snap.data() ?? {});
          if (!patch) return false;
          tx.update(ref, patch);
          return true;
        }),
      ),
    );
    updated += results.filter(Boolean).length;
  }
  return updated;
}

/** Copie puis supprime une cotisation (copier d'abord : relançable après crash). */
async function moveFee(params: {
  firestore: Firestore;
  sourceRef: DocumentReference;
  targetRef: DocumentReference;
  source: DocumentSnapshot;
  sourceEvents: QueryDocumentSnapshot[];
  uid: string;
}): Promise<void> {
  const { firestore, sourceRef, targetRef, source, sourceEvents, uid } = params;
  const copy = firestore.batch();
  for (const event of sourceEvents) {
    copy.set(targetRef.collection("payment_events").doc(event.id), event.data());
  }
  copy.set(targetRef, { ...source.data(), memberId: uid });
  await copy.commit();

  const cleanup = firestore.batch();
  for (const event of sourceEvents) cleanup.delete(event.ref);
  cleanup.delete(sourceRef);
  await cleanup.commit();
}

/**
 * Réécrit toutes les références à [from] sous [uid] : équipes, événements
 * (tous, passés compris, en écriture silencieuse), annonces « Personnes »,
 * invitations, sessions de paiement et cotisations. Chaque étape interroge
 * par [from] : relancer ne refait rien. `rekeyPendingFrom` est effacé sauf
 * conflit de cotisation.
 */
export async function rewriteMemberReferences(params: {
  firestore: Firestore;
  clubId: string;
  from: string;
  uid: string;
}): Promise<RekeyReferencesReport> {
  const { firestore, clubId, from, uid } = params;
  const report: RekeyReferencesReport = {
    teams: 0,
    events: 0,
    announcements: 0,
    invitations: 0,
    paymentSessions: 0,
    feesMoved: 0,
    feesDropped: 0,
    feeConflictSeasonIds: [],
  };
  if (!from || !uid || from === uid) return report;

  const clubRef = firestore.collection("clubs").doc(clubId);
  const updates: Array<[DocumentReference, Record<string, unknown>]> = [];

  // Équipes, événements, annonces : patchs de tableaux / maps entiers. Ils
  // sont recalculés dans une transaction par document depuis une lecture
  // fraîche (jamais depuis le scan initial) pour ne pas écraser une écriture
  // concurrente (ex. un joueur ajouté au roster ou convoqué entre-temps).
  const teams = clubRef.collection("teams");
  const teamSnaps = await Promise.all(
    TEAM_ROSTER_FIELDS.map((field) =>
      teams.where(field, "array-contains", from).get(),
    ),
  );
  const teamDocs = new Map<string, QueryDocumentSnapshot>();
  for (const snap of teamSnaps) {
    for (const doc of snap.docs) teamDocs.set(doc.id, doc);
  }
  report.teams = await updateEachInTransaction(
    firestore,
    [...teamDocs.values()]
      .filter((doc) => buildTeamRekeyPatch(doc.data(), from, uid) != null)
      .map((doc) => doc.ref),
    (data) => buildTeamRekeyPatch(data, from, uid),
  );

  const buildEventPatch = (data: DocumentData) => {
    const patch = buildEventRekeyPatch({
      event: data,
      from,
      to: uid,
      deleteField: FieldValue.delete(),
    });
    // Écriture technique : pas de push de convocation / modification.
    if (patch) patch[SILENT_WRITE_FIELD] = FieldValue.serverTimestamp();
    return patch;
  };
  const events = clubRef.collection("events");
  const eventRefs: DocumentReference[] = [];
  let lastEvent: QueryDocumentSnapshot | undefined;
  for (;;) {
    let query = events
      .orderBy(FieldPath.documentId())
      .select(...EVENT_REKEY_FIELDS)
      .limit(EVENTS_PAGE_SIZE);
    if (lastEvent) query = query.startAfter(lastEvent);
    const page = await query.get();
    for (const doc of page.docs) {
      if (buildEventPatch(doc.data())) eventRefs.push(doc.ref);
    }
    if (page.size < EVENTS_PAGE_SIZE) break;
    lastEvent = page.docs[page.docs.length - 1];
  }
  report.events = await updateEachInTransaction(firestore, eventRefs, buildEventPatch);

  const buildAnnouncementPatch = (data: DocumentData) => {
    if (data.targetType !== ANNOUNCEMENT_TARGET_PEOPLE) return null;
    const next = migrateTeamMemberIds(stringArray(data.targetIds), from, uid);
    return next ? { targetIds: next } : null;
  };
  const announcements = await clubRef
    .collection("announcements")
    .where("targetIds", "array-contains", from)
    .get();
  report.announcements = await updateEachInTransaction(
    firestore,
    announcements.docs
      .filter((doc) => buildAnnouncementPatch(doc.data()) != null)
      .map((doc) => doc.ref),
    buildAnnouncementPatch,
  );

  const invitations = await clubRef
    .collection("invitations")
    .where("memberId", "==", from)
    .get();
  for (const doc of invitations.docs) {
    updates.push([doc.ref, { memberId: uid }]);
    report.invitations += 1;
  }

  const seasons = await clubRef.collection("fee_seasons").select().get();
  for (const season of seasons.docs) {
    const sessions = await season.ref
      .collection("payment_sessions")
      .where("memberId", "==", from)
      .get();
    for (const doc of sessions.docs) {
      updates.push([doc.ref, { memberId: uid }]);
      report.paymentSessions += 1;
    }
  }
  await commitUpdates(firestore, updates);

  for (const season of seasons.docs) {
    const fees = season.ref.collection("member_fees");
    const sourceRef = fees.doc(from);
    const targetRef = fees.doc(uid);
    const [source, target] = await firestore.getAll(sourceRef, targetRef);
    if (!source.exists) continue;
    const [sourceEvents, targetEvents] = await Promise.all([
      sourceRef.collection("payment_events").get(),
      targetRef.collection("payment_events").limit(1).get(),
    ]);
    const sourceState: FeeState = {
      data: source.data()!,
      paymentEventCount: sourceEvents.size,
    };
    const targetState: FeeState = target.exists
      ? { data: target.data()!, paymentEventCount: targetEvents.size }
      : null;
    const decision = feeMoveDecision(sourceState, targetState);
    if (decision === "conflict") {
      report.feeConflictSeasonIds.push(season.id);
    } else if (decision === "drop-empty-source") {
      await sourceRef.delete();
      report.feesDropped += 1;
    } else if (decision === "move" || decision === "drop-empty-target-then-move") {
      await moveFee({
        firestore,
        sourceRef,
        targetRef,
        source,
        sourceEvents: sourceEvents.docs,
        uid,
      });
      report.feesMoved += 1;
    }
  }

  const memberRef = clubRef.collection("members").doc(uid);
  const member = await memberRef.get();
  if (member.exists && member.get("rekeyPendingFrom") === from) {
    if (report.feeConflictSeasonIds.length === 0) {
      await memberRef.update({
        rekeyPendingFrom: FieldValue.delete(),
        [REKEY_FAILED_AT_FIELD]: FieldValue.delete(),
        [REKEY_FAILURE_COUNT_FIELD]: FieldValue.delete(),
        [REKEY_LAST_ERROR_FIELD]: FieldValue.delete(),
        [REKEY_FEE_CONFLICT_FIELD]: FieldValue.delete(),
      });
    } else {
      // Conflit de cotisation : un admin tranche ; la reprise automatique
      // (`memberRekeyResume.ts`) ignore cette fiche.
      await memberRef.update({
        [REKEY_FEE_CONFLICT_FIELD]: report.feeConflictSeasonIds,
      });
    }
  }
  return report;
}

/** Re-keying de références en échec : horodatage du dernier échec. */
export const REKEY_FAILED_AT_FIELD = "rekeyFailedAt";
/** Nombre d'échecs consécutifs de la réécriture des références. */
export const REKEY_FAILURE_COUNT_FIELD = "rekeyFailureCount";
/** Message (tronqué) du dernier échec. */
export const REKEY_LAST_ERROR_FIELD = "rekeyLastError";
/** Saisons en conflit de cotisation (reprise automatique suspendue). */
export const REKEY_FEE_CONFLICT_FIELD = "rekeyFeeConflictSeasonIds";

/**
 * [rewriteMemberReferences] avec relances (backoff exponentiel). Après le
 * dernier échec, l'état incomplet reste persistant sur la fiche
 * `members/{uid}` : `rekeyPendingFrom` (posé par [writeRekeyCore]) plus
 * `rekeyFailedAt` / `rekeyFailureCount` / `rekeyLastError` ; la tâche
 * planifiée `scheduleMemberRekeyResume` reprend alors la réécriture.
 * Ne lève jamais : retourne `null` si toutes les tentatives ont échoué.
 */
export async function rewriteMemberReferencesWithRetry(params: {
  firestore: Firestore;
  clubId: string;
  from: string;
  uid: string;
  attempts?: number;
  baseDelayMs?: number;
}): Promise<RekeyReferencesReport | null> {
  const attempts = Math.max(1, params.attempts ?? 3);
  const baseDelayMs = params.baseDelayMs ?? 500;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await rewriteMemberReferences(params);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }
  console.error("rewriteMemberReferences failed (reprise planifiée)", {
    clubId: params.clubId,
    from: params.from,
    error: lastError,
  });
  try {
    await params.firestore
      .collection("clubs")
      .doc(params.clubId)
      .collection("members")
      .doc(params.uid)
      .update({
        [REKEY_FAILED_AT_FIELD]: FieldValue.serverTimestamp(),
        [REKEY_FAILURE_COUNT_FIELD]: FieldValue.increment(1),
        [REKEY_LAST_ERROR_FIELD]: String(
          lastError instanceof Error ? lastError.message : lastError,
        ).slice(0, 500),
      });
  } catch (markError) {
    console.error("rewriteMemberReferences: marquage de l'échec impossible", {
      clubId: params.clubId,
      uid: params.uid,
      markError,
    });
  }
  return null;
}

/**
 * Re-keye `members/{fromMemberId}` vers `members/{uid}` puis réécrit toutes
 * ses références. Reprend un re-keying interrompu (fiche déjà déplacée).
 * Sans [mergeDuplicates], une fiche déjà présente à l'uid est signalée
 * (`skipped` / `collision`) au lieu d'être fusionnée.
 */
export async function rekeyMemberToAccount(params: {
  firestore: Firestore;
  clubId: string;
  fromMemberId: string;
  uid: string;
  mergeDuplicates?: boolean;
}): Promise<RekeyReport> {
  const { firestore, clubId, fromMemberId, uid } = params;
  if (!fromMemberId || !uid || fromMemberId === uid) return { core: "already" };
  let core: RekeyCoreOutcome;
  try {
    core = await firestore.runTransaction(async (tx) => {
      const state = await readRekeyCore(tx, { firestore, clubId, fromMemberId, uid });
      return writeRekeyCore(tx, state, { mergeDuplicates: params.mergeDuplicates });
    });
  } catch (error) {
    if (error instanceof MemberRekeyError) {
      return { core: "skipped", skippedReason: error.code };
    }
    throw error;
  }
  const references = await rewriteMemberReferences({
    firestore,
    clubId,
    from: fromMemberId,
    uid,
  });
  return { core, references };
}
