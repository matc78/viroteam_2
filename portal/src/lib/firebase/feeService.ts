import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getAppFirestore, getFirebaseAuth } from "./app";
import {
  Collections,
  FeeAidStatuses,
  FeePaidVia,
  Fields,
  MemberFeeStatuses,
  OfflinePaymentMethod,
  OfflinePaymentMethods,
} from "./constants";
import { toDate } from "./types";

/** Moyen de paiement accepté (aligné Flutter). */
export type FeePaymentMethod =
  | "carte_bancaire"
  | "virement"
  | "cheque"
  | "especes"
  | "ancv"
  | "cheques_vacances";

/** Palier tarifaire. */
export type FeeTier = {
  tierId: string;
  label: string;
  amountCents: number;
  /** Catégorie sport associée (optionnel, pour application intelligente). */
  category: string | null;
};

/** Saison de cotisations. */
export type FeeSeasonRecord = {
  id: string;
  seasonLabel: string;
  isActive: boolean;
  currency: string;
  paymentDeadlineAt: Date | null;
  paymentInstructions: string;
  paymentMethods: FeePaymentMethod[];
  iban: string;
  tiers: FeeTier[];
  createdBy: string;
};

/** Aide / réduction sur une fiche cotisation. */
export type FeeAidRecord = {
  id: string;
  type: string;
  label: string;
  amountCents: number;
  status: string;
  promoCode: string | null;
  validatedBy: string | null;
  validatedAt: Date | null;
};

/** Fiche cotisation membre. */
export type MemberFeeRecord = {
  id: string;
  memberDisplayName: string;
  tierId: string | null;
  status: string;
  amountPaidCents: number;
  paidAt: Date | null;
  paidVia: string | null;
  paymentProvider: string | null;
  aids: FeeAidRecord[];
};

const VALID_METHODS = new Set<string>([
  "carte_bancaire",
  "virement",
  "cheque",
  "especes",
  "ancv",
  "cheques_vacances",
]);

function feeSeasonsCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.feeSeasons,
  );
}

function memberFeesCol(clubId: string, seasonId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.feeSeasons,
    seasonId,
    Collections.memberFees,
  );
}

function parseTiers(raw: unknown): FeeTier[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => {
      const categoryRaw = item[Fields.category];
      const category =
        typeof categoryRaw === "string" && categoryRaw.trim()
          ? categoryRaw.trim()
          : null;
      return {
        tierId: String(item[Fields.tierId] ?? ""),
        label: String(item[Fields.label] ?? ""),
        amountCents: Number(item[Fields.amountCents] ?? 0),
        category,
      };
    });
}

function parseMethods(raw: unknown): FeePaymentMethod[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item))
    .filter((item): item is FeePaymentMethod => VALID_METHODS.has(item));
}

/** Parse un document fee_seasons. */
export function parseFeeSeason(
  id: string,
  data: Record<string, unknown>,
): FeeSeasonRecord {
  return {
    id,
    seasonLabel: String(data[Fields.seasonLabel] ?? ""),
    isActive: Boolean(data[Fields.isActive]),
    currency: String(data[Fields.currency] ?? "EUR"),
    paymentDeadlineAt: toDate(data[Fields.paymentDeadlineAt]),
    paymentInstructions: String(data[Fields.paymentInstructions] ?? ""),
    paymentMethods: parseMethods(data[Fields.paymentMethods]),
    iban: String(data[Fields.iban] ?? ""),
    tiers: parseTiers(data[Fields.tiers]),
    createdBy: String(data[Fields.createdBy] ?? ""),
  };
}

function parseAids(raw: unknown): FeeAidRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      id: String(item[Fields.id] ?? item.id ?? ""),
      type: String(item[Fields.type] ?? "other"),
      label: String(item[Fields.label] ?? ""),
      amountCents: Number(item[Fields.amountCents] ?? 0),
      status: String(item[Fields.status] ?? FeeAidStatuses.pendingProof),
      promoCode:
        item[Fields.promoCode] != null ? String(item[Fields.promoCode]) : null,
      validatedBy:
        item[Fields.validatedBy] != null
          ? String(item[Fields.validatedBy])
          : null,
      validatedAt: toDate(item[Fields.validatedAt]),
    }));
}

/** Parse un document member_fees. */
export function parseMemberFee(
  id: string,
  data: Record<string, unknown>,
): MemberFeeRecord {
  return {
    id,
    memberDisplayName: String(data[Fields.memberDisplayName] ?? ""),
    tierId: data[Fields.tierId] != null ? String(data[Fields.tierId]) : null,
    status: String(data[Fields.feeStatus] ?? MemberFeeStatuses.aPayer),
    amountPaidCents: Number(data[Fields.amountPaidCents] ?? 0),
    paidAt: toDate(data[Fields.paidAt]),
    paidVia: data[Fields.paidVia] != null ? String(data[Fields.paidVia]) : null,
    paymentProvider:
      data[Fields.paymentProvider] != null
        ? String(data[Fields.paymentProvider])
        : null,
    aids: parseAids(data[Fields.aids]),
  };
}

/** Charge la saison active du club (`isActive == true`). Retourne la première si plusieurs. */
export async function getActiveSeason(
  clubId: string,
): Promise<FeeSeasonRecord | null> {
  const activeSeasonQuery = query(feeSeasonsCol(clubId), where(Fields.isActive, "==", true));
  const snap = await getDocs(activeSeasonQuery);
  if (snap.empty) return null;
  const first = snap.docs[0];
  return parseFeeSeason(first.id, first.data() as Record<string, unknown>);
}

/** Liste les fiches cotisation d’une saison. */
export async function listMemberFees(
  clubId: string,
  seasonId: string,
): Promise<MemberFeeRecord[]> {
  const snap = await getDocs(memberFeesCol(clubId, seasonId));
  return snap.docs.map((docSnap) =>
    parseMemberFee(docSnap.id, docSnap.data() as Record<string, unknown>),
  );
}

export type SeasonWriteInput = {
  seasonLabel: string;
  currency: string;
  paymentDeadlineAt: Date | null;
  paymentInstructions: string;
  paymentMethods: FeePaymentMethod[];
  iban: string;
  tiers: FeeTier[];
  createdBy: string;
};

function tiersPayload(tiers: FeeTier[]) {
  return tiers.map((tier) => {
    const payload: Record<string, unknown> = {
      [Fields.tierId]: tier.tierId,
      [Fields.label]: tier.label,
      [Fields.amountCents]: tier.amountCents,
    };
    if (tier.category) {
      payload[Fields.category] = tier.category;
    }
    return payload;
  });
}

/** Crée une saison active (désactive les autres si besoin). */
export async function createSeason(
  clubId: string,
  input: SeasonWriteInput,
): Promise<string> {
  const col = feeSeasonsCol(clubId);
  const newRef = doc(col);
  const data: Record<string, unknown> = {
    [Fields.seasonLabel]: input.seasonLabel,
    [Fields.isActive]: true,
    [Fields.currency]: input.currency,
    [Fields.paymentInstructions]: input.paymentInstructions,
    [Fields.paymentMethods]: input.paymentMethods,
    [Fields.tiers]: tiersPayload(input.tiers),
    [Fields.createdAt]: serverTimestamp(),
    [Fields.updatedAt]: serverTimestamp(),
    [Fields.createdBy]: input.createdBy,
  };
  if (input.paymentDeadlineAt) {
    data[Fields.paymentDeadlineAt] = Timestamp.fromDate(input.paymentDeadlineAt);
  }
  if (input.iban.trim()) {
    data[Fields.iban] = input.iban.trim();
  }

  const existingActive = await getDocs(
    query(col, where(Fields.isActive, "==", true)),
  );
  const batch = writeBatch(getAppFirestore());
  for (const activeDoc of existingActive.docs) {
    batch.update(activeDoc.ref, { [Fields.isActive]: false });
  }
  batch.set(newRef, data);
  await batch.commit();
  return newRef.id;
}

/** Met à jour une saison existante. */
export async function updateSeason(
  clubId: string,
  seasonId: string,
  input: Omit<SeasonWriteInput, "createdBy">,
): Promise<void> {
  const ref = doc(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.feeSeasons,
    seasonId,
  );
  const data: Record<string, unknown> = {
    [Fields.seasonLabel]: input.seasonLabel,
    [Fields.currency]: input.currency,
    [Fields.paymentInstructions]: input.paymentInstructions,
    [Fields.paymentMethods]: input.paymentMethods,
    [Fields.tiers]: tiersPayload(input.tiers),
    [Fields.updatedAt]: serverTimestamp(),
  };
  if (input.paymentDeadlineAt) {
    data[Fields.paymentDeadlineAt] = Timestamp.fromDate(input.paymentDeadlineAt);
  } else {
    data[Fields.paymentDeadlineAt] = deleteField();
  }
  if (input.iban.trim()) {
    data[Fields.iban] = input.iban.trim();
  } else {
    data[Fields.iban] = deleteField();
  }
  await updateDoc(ref, data);
}

/** Formate une Date en `YYYY-MM-DD` (local). */
export function formatDateInput(date: Date | null): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse `YYYY-MM-DD` en Date locale (minuit). */
export function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
}

function memberFeeRef(clubId: string, seasonId: string, memberId: string) {
  return doc(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.feeSeasons,
    seasonId,
    Collections.memberFees,
    memberId,
  );
}

function currentUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Non connecté");
  return uid;
}

/** Montant catalogue dû pour une fiche (palier). */
export function amountDueCents(
  fee: MemberFeeRecord,
  season: FeeSeasonRecord,
): number {
  if (fee.status === MemberFeeStatuses.exonere) return 0;
  if (!fee.tierId) return 0;
  const tier = season.tiers.find((item) => item.tierId === fee.tierId);
  return tier?.amountCents ?? 0;
}

/** Somme des aides validées. */
export function validatedAidsCents(fee: MemberFeeRecord): number {
  return fee.aids
    .filter((aid) => aid.status === FeeAidStatuses.validated)
    .reduce((sum, aid) => sum + aid.amountCents, 0);
}

/** Reste à encaisser / justifier. */
export function remainingCents(
  fee: MemberFeeRecord,
  season: FeeSeasonRecord,
): number {
  const due = amountDueCents(fee, season);
  const covered = fee.amountPaidCents + validatedAidsCents(fee);
  const remaining = due - covered;
  return remaining < 0 ? 0 : remaining;
}

/** Charge une fiche cotisation membre. */
export async function getMemberFee(
  clubId: string,
  seasonId: string,
  memberId: string,
): Promise<MemberFeeRecord | null> {
  const snap = await getDoc(memberFeeRef(clubId, seasonId, memberId));
  if (!snap.exists()) return null;
  return parseMemberFee(snap.id, snap.data() as Record<string, unknown>);
}

/** Valide un paiement hors-ligne (chèque, espèces, …). */
export async function validateOfflinePayment(params: {
  clubId: string;
  seasonId: string;
  memberId: string;
  offlineMethod: OfflinePaymentMethod;
  amountCents: number;
  season: FeeSeasonRecord;
}): Promise<void> {
  const { clubId, seasonId, memberId, offlineMethod, amountCents, season } =
    params;
  if (amountCents < 0) throw new Error("Montant invalide");
  if (!OfflinePaymentMethods.includes(offlineMethod)) {
    throw new Error("Moyen hors-ligne inconnu");
  }

  const fee = await getMemberFee(clubId, seasonId, memberId);
  if (!fee) throw new Error("Fiche cotisation introuvable");
  if (!fee.tierId) {
    throw new Error("Aucune cotisation assignée pour ce membre");
  }
  if (fee.status === MemberFeeStatuses.exonere) {
    throw new Error("Membre exonéré — paiement impossible");
  }

  const uid = currentUid();
  const newPaid = fee.amountPaidCents + amountCents;
  const covered = newPaid + validatedAidsCents(fee);
  const due = amountDueCents(fee, season);
  const isFullyPaid = due - covered <= 0;

  await updateDoc(memberFeeRef(clubId, seasonId, memberId), {
    [Fields.amountPaidCents]: newPaid,
    [Fields.offlineMethod]: offlineMethod,
    [Fields.paidVia]: FeePaidVia.offline,
    [Fields.feeStatus]: isFullyPaid
      ? MemberFeeStatuses.paye
      : MemberFeeStatuses.partiel,
    ...(isFullyPaid ? { [Fields.paidAt]: serverTimestamp() } : {}),
    [Fields.markedBy]: uid,
    [Fields.updatedAt]: serverTimestamp(),
  });
}

/** Résultat d’un encaissement groupé hors-ligne. */
export type BulkOfflinePaymentResult = {
  applied: number;
  skipped: number;
};

/**
 * Enregistre le reste dû pour chaque membre, avec le même moyen hors-ligne.
 * Ignore sans fiche, sans palier, exonérés, ou déjà soldés.
 */
export async function bulkValidateOfflinePayments(params: {
  clubId: string;
  seasonId: string;
  season: FeeSeasonRecord;
  offlineMethod: OfflinePaymentMethod;
  memberIds: string[];
}): Promise<BulkOfflinePaymentResult> {
  const { clubId, seasonId, season, offlineMethod, memberIds } = params;
  if (!OfflinePaymentMethods.includes(offlineMethod)) {
    throw new Error("Moyen hors-ligne inconnu");
  }

  let applied = 0;
  let skipped = 0;
  const uniqueIds = [...new Set(memberIds)];

  for (const memberId of uniqueIds) {
    const fee = await getMemberFee(clubId, seasonId, memberId);
    if (
      !fee ||
      !fee.tierId ||
      fee.status === MemberFeeStatuses.exonere ||
      fee.status === MemberFeeStatuses.paye
    ) {
      skipped += 1;
      continue;
    }
    const remaining = remainingCents(fee, season);
    if (remaining <= 0) {
      skipped += 1;
      continue;
    }
    await validateOfflinePayment({
      clubId,
      seasonId,
      memberId,
      offlineMethod,
      amountCents: remaining,
      season,
    });
    applied += 1;
  }

  return { applied, skipped };
}

/** Valide ou refuse un justificatif d'aide. */
export async function setFeeAidStatus(params: {
  clubId: string;
  seasonId: string;
  memberId: string;
  aidId: string;
  aidStatus: typeof FeeAidStatuses.validated | typeof FeeAidStatuses.rejected;
  season: FeeSeasonRecord;
}): Promise<void> {
  const { clubId, seasonId, memberId, aidId, aidStatus, season } = params;
  if (
    aidStatus !== FeeAidStatuses.validated &&
    aidStatus !== FeeAidStatuses.rejected
  ) {
    throw new Error("Statut aide invalide");
  }

  const fee = await getMemberFee(clubId, seasonId, memberId);
  if (!fee) throw new Error("Fiche cotisation introuvable");

  const uid = currentUid();
  const updatedAids = fee.aids.map((aid) => {
    if (aid.id !== aidId) return aid;
    return {
      ...aid,
      status: aidStatus,
      validatedBy: uid,
      validatedAt: new Date(),
    };
  });

  const validatedAids = updatedAids
    .filter((aid) => aid.status === FeeAidStatuses.validated)
    .reduce((sum, aid) => sum + aid.amountCents, 0);
  const covered = fee.amountPaidCents + validatedAids;
  const due = amountDueCents(fee, season);
  const remaining = due - covered;
  const hasPending =
    updatedAids.some((aid) => aid.status === FeeAidStatuses.pendingProof) ||
    remaining > 0;

  let nextStatus: string;
  if (fee.status === MemberFeeStatuses.exonere) {
    nextStatus = MemberFeeStatuses.exonere;
  } else if (
    remaining <= 0 &&
    !updatedAids.some((aid) => aid.status === FeeAidStatuses.pendingProof)
  ) {
    nextStatus = MemberFeeStatuses.paye;
  } else if (fee.amountPaidCents > 0 || validatedAids > 0) {
    nextStatus = MemberFeeStatuses.partiel;
  } else {
    nextStatus = MemberFeeStatuses.aPayer;
  }

  await updateDoc(memberFeeRef(clubId, seasonId, memberId), {
    [Fields.aids]: updatedAids.map((aid) => ({
      [Fields.id]: aid.id,
      [Fields.type]: aid.type,
      [Fields.label]: aid.label,
      [Fields.amountCents]: aid.amountCents,
      [Fields.status]: aid.status,
      ...(aid.promoCode ? { [Fields.promoCode]: aid.promoCode } : {}),
      ...(aid.validatedBy ? { [Fields.validatedBy]: aid.validatedBy } : {}),
      ...(aid.validatedAt
        ? { [Fields.validatedAt]: Timestamp.fromDate(aid.validatedAt) }
        : {}),
    })),
    [Fields.feeStatus]: nextStatus,
    ...(nextStatus === MemberFeeStatuses.paye
      ? { [Fields.paidAt]: serverTimestamp() }
      : hasPending && nextStatus !== MemberFeeStatuses.paye
        ? { [Fields.paidAt]: deleteField() }
        : {}),
    [Fields.markedBy]: uid,
    [Fields.updatedAt]: serverTimestamp(),
  });
}

const FEE_STATUS_VALUES = new Set<string>([
  MemberFeeStatuses.aPayer,
  MemberFeeStatuses.partiel,
  MemberFeeStatuses.paye,
  MemberFeeStatuses.exonere,
]);

/**
 * Force le statut cotisation d’une fiche (actions bulk / admin).
 * La fiche `member_fees/{memberId}` doit déjà exister.
 */
export async function setMemberFeeStatus(params: {
  clubId: string;
  seasonId: string;
  memberId: string;
  status:
    | typeof MemberFeeStatuses.aPayer
    | typeof MemberFeeStatuses.partiel
    | typeof MemberFeeStatuses.paye
    | typeof MemberFeeStatuses.exonere;
}): Promise<void> {
  const { clubId, seasonId, memberId, status } = params;
  if (!FEE_STATUS_VALUES.has(status)) {
    throw new Error("Statut cotisation invalide");
  }

  const feeRef = memberFeeRef(clubId, seasonId, memberId);
  const snap = await getDoc(feeRef);
  if (!snap.exists()) {
    throw new Error("Fiche cotisation introuvable pour ce membre");
  }

  const uid = currentUid();
  const payload: Record<string, unknown> = {
    [Fields.feeStatus]: status,
    [Fields.paidVia]: FeePaidVia.manual,
    [Fields.markedBy]: uid,
    [Fields.updatedAt]: serverTimestamp(),
  };

  if (status === MemberFeeStatuses.paye) {
    payload[Fields.paidAt] = serverTimestamp();
  } else {
    payload[Fields.paidAt] = deleteField();
  }

  await updateDoc(feeRef, payload);
}

/** Modification cotisation / statut à appliquer (création si besoin). */
export type MemberFeeApplyChange = {
  memberId: string;
  memberDisplayName: string;
  /** `null` = retirer le palier ; `undefined` = ne pas toucher. */
  tierId?: string | null;
  /** `null` / vide interdit ; `undefined` = ne pas toucher. */
  status?: string;
  /** La fiche existait déjà avant la validation. */
  feeExists: boolean;
};

/**
 * Applique en lot palier et/ou statut.
 * Crée la fiche `member_fees/{memberId}` si elle n’existe pas.
 * Sans palier, seul le statut `exonere` est autorisé (pas à payer / partiel / payé).
 */
export async function applyMemberFeeChanges(params: {
  clubId: string;
  seasonId: string;
  changes: MemberFeeApplyChange[];
}): Promise<void> {
  const { clubId, seasonId, changes } = params;
  if (changes.length === 0) return;

  const uid = currentUid();
  const db = getAppFirestore();
  const maxBatch = 450;
  const assignableWithoutTier = new Set<string>([MemberFeeStatuses.exonere]);

  for (let offset = 0; offset < changes.length; offset += maxBatch) {
    const slice = changes.slice(offset, offset + maxBatch);
    const batch = writeBatch(db);

    for (const change of slice) {
      if (
        change.status !== undefined &&
        !FEE_STATUS_VALUES.has(change.status)
      ) {
        throw new Error(`Statut cotisation invalide (${change.memberId})`);
      }
      if (
        change.status === MemberFeeStatuses.partiel ||
        change.status === MemberFeeStatuses.paye
      ) {
        throw new Error(
          "Les statuts Partiel et Payé s’enregistrent via un paiement (moyen + montant)",
        );
      }

      const feeRef = memberFeeRef(clubId, seasonId, change.memberId);
      const existing = change.feeExists
        ? await getMemberFee(clubId, seasonId, change.memberId)
        : null;

      const nextTierId =
        change.tierId !== undefined ? change.tierId : (existing?.tierId ?? null);
      const nextStatus =
        change.status ??
        existing?.status ??
        (change.feeExists ? undefined : MemberFeeStatuses.aPayer);

      if (
        !nextTierId &&
        nextStatus &&
        !assignableWithoutTier.has(nextStatus)
      ) {
        throw new Error(
          "Sans cotisation assignée, seul le statut Exonéré est autorisé",
        );
      }

      if (!change.feeExists) {
        const createStatus = nextStatus ?? MemberFeeStatuses.aPayer;
        if (!nextTierId && createStatus !== MemberFeeStatuses.exonere) {
          throw new Error(
            "Sans cotisation assignée, seul le statut Exonéré est autorisé",
          );
        }
        const createPayload: Record<string, unknown> = {
          [Fields.memberId]: change.memberId,
          [Fields.memberDisplayName]: change.memberDisplayName,
          [Fields.feeStatus]: createStatus,
          [Fields.amountPaidCents]: 0,
          [Fields.aids]: [],
          [Fields.markedBy]: uid,
          [Fields.createdAt]: serverTimestamp(),
          [Fields.updatedAt]: serverTimestamp(),
        };
        if (nextTierId) {
          createPayload[Fields.tierId] = nextTierId;
        }
        if (createStatus === MemberFeeStatuses.exonere) {
          createPayload[Fields.paidVia] = FeePaidVia.manual;
        }
        batch.set(feeRef, createPayload);
        continue;
      }

      const updatePayload: Record<string, unknown> = {
        [Fields.memberDisplayName]: change.memberDisplayName,
        [Fields.markedBy]: uid,
        [Fields.updatedAt]: serverTimestamp(),
      };

      if (change.tierId !== undefined) {
        if (change.tierId) {
          updatePayload[Fields.tierId] = change.tierId;
        } else {
          updatePayload[Fields.tierId] = deleteField();
        }
      }

      if (change.status !== undefined) {
        updatePayload[Fields.feeStatus] = change.status;
        updatePayload[Fields.paidVia] = FeePaidVia.manual;
        updatePayload[Fields.paidAt] = deleteField();
      }

      batch.set(feeRef, updatePayload, { merge: true });
    }

    await batch.commit();
  }
}
