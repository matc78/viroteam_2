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

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
}

function linkedAccountUid(data: DocumentData | null | undefined): string {
  return String(data?.accountUid ?? data?.userId ?? "").trim();
}

/** Ids précédents d'une fiche (`formerMemberIds`). */
export function formerMemberIdsOf(data: DocumentData | undefined): string[] {
  return stringList(data?.formerMemberIds);
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
  for (const linked of [linkedAccountUid(sourceData), linkedAccountUid(targetData)]) {
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
  tx.set(state.targetRef, {
    ...base,
    ...options.extraFields,
    memberId: uid,
    accountUid: uid,
    userId: uid,
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

  // Auto-pointeur gardé pendant la transition (anciennes apps, règles).
  tx.set(state.clubRef.collection("member_accounts").doc(uid), { memberId: uid });
  tx.delete(state.sourceRef);

  const clubData = state.club.data() ?? {};
  const clubPatch: Record<string, unknown> = {};
  const nextAdminIds = migrateTeamMemberIds(stringList(clubData.adminIds), from, uid);
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

  const teams = clubRef.collection("teams");
  const teamSnaps = await Promise.all(
    ["playerIds", "coachIds", "pendingPlayerIds"].map((field) =>
      teams.where(field, "array-contains", from).get(),
    ),
  );
  const teamDocs = new Map<string, QueryDocumentSnapshot>();
  for (const snap of teamSnaps) {
    for (const doc of snap.docs) teamDocs.set(doc.id, doc);
  }
  for (const doc of teamDocs.values()) {
    const patch = buildTeamRekeyPatch(doc.data(), from, uid);
    if (!patch) continue;
    updates.push([doc.ref, patch]);
    report.teams += 1;
  }

  const events = clubRef.collection("events");
  let lastEvent: QueryDocumentSnapshot | undefined;
  for (;;) {
    let query = events
      .orderBy(FieldPath.documentId())
      .select(...EVENT_REKEY_FIELDS)
      .limit(EVENTS_PAGE_SIZE);
    if (lastEvent) query = query.startAfter(lastEvent);
    const page = await query.get();
    for (const doc of page.docs) {
      const patch = buildEventRekeyPatch({
        event: doc.data(),
        from,
        to: uid,
        deleteField: FieldValue.delete(),
      });
      if (!patch) continue;
      // Écriture technique : pas de push de convocation / modification.
      patch[SILENT_WRITE_FIELD] = FieldValue.serverTimestamp();
      updates.push([doc.ref, patch]);
      report.events += 1;
    }
    if (page.size < EVENTS_PAGE_SIZE) break;
    lastEvent = page.docs[page.docs.length - 1];
  }

  const announcements = await clubRef
    .collection("announcements")
    .where("targetIds", "array-contains", from)
    .get();
  for (const doc of announcements.docs) {
    if (doc.get("targetType") !== ANNOUNCEMENT_TARGET_PEOPLE) continue;
    const next = migrateTeamMemberIds(stringList(doc.get("targetIds")), from, uid);
    if (!next) continue;
    updates.push([doc.ref, { targetIds: next }]);
    report.announcements += 1;
  }

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

  if (report.feeConflictSeasonIds.length === 0) {
    const memberRef = clubRef.collection("members").doc(uid);
    const member = await memberRef.get();
    if (member.exists && member.get("rekeyPendingFrom") === from) {
      await memberRef.update({ rekeyPendingFrom: FieldValue.delete() });
    }
  }
  return report;
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

/**
 * Id de fiche actuel pour [id] : lui-même si `members/{id}` existe, sinon la
 * fiche qui l'a remplacé (`formerMemberIds`). Compat transition re-keying
 * (anciens clients, sessions Stripe créées avant le déplacement).
 */
export async function resolveCurrentMemberId(
  firestore: Firestore,
  clubId: string,
  id: string,
): Promise<string> {
  const members = firestore.collection("clubs").doc(clubId).collection("members");
  const snap = await members.doc(id).get();
  if (snap.exists) return id;
  const moved = await members
    .where("formerMemberIds", "array-contains", id)
    .limit(1)
    .get();
  return moved.empty ? id : moved.docs[0].id;
}
