import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import { getAppFirestore, getFirebaseAuth } from "./app";
import {
  Collections,
  FeeAidStatuses,
  FeePaidVia,
  FeePaymentEventTypes,
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
  /** Moyen hors-ligne (chèque, espèces…) si `paidVia === offline`. */
  offlineMethod: string | null;
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

function paymentEventsCol(
  clubId: string,
  seasonId: string,
  memberId: string,
) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.feeSeasons,
    seasonId,
    Collections.memberFees,
    memberId,
    Collections.paymentEvents,
  );
}

/** Entrée d’historique cotisation. */
export type FeePaymentEventRecord = {
  id: string;
  type: string;
  deltaCents: number;
  amountPaidCentsBefore: number;
  amountPaidCentsAfter: number;
  statusAfter: string;
  actorUid: string;
  createdAt: Date | null;
  offlineMethod: string | null;
  paidVia: string | null;
  paymentProvider: string | null;
  externalPaymentId: string | null;
  sessionId: string | null;
  aidId: string | null;
  aidLabel: string | null;
  aidAmountCents: number | null;
  note: string | null;
};

function parsePaymentEvent(
  id: string,
  data: Record<string, unknown>,
): FeePaymentEventRecord {
  return {
    id,
    type: String(data[Fields.type] ?? ""),
    deltaCents: Number(data[Fields.deltaCents] ?? 0),
    amountPaidCentsBefore: Number(data[Fields.amountPaidCentsBefore] ?? 0),
    amountPaidCentsAfter: Number(data[Fields.amountPaidCentsAfter] ?? 0),
    statusAfter: String(data[Fields.statusAfter] ?? ""),
    actorUid: String(data[Fields.actorUid] ?? ""),
    createdAt: toDate(data[Fields.createdAt]),
    offlineMethod:
      data[Fields.offlineMethod] != null
        ? String(data[Fields.offlineMethod])
        : null,
    paidVia: data[Fields.paidVia] != null ? String(data[Fields.paidVia]) : null,
    paymentProvider:
      data[Fields.paymentProvider] != null
        ? String(data[Fields.paymentProvider])
        : null,
    externalPaymentId:
      data[Fields.externalPaymentId] != null
        ? String(data[Fields.externalPaymentId])
        : null,
    sessionId:
      data[Fields.sessionId] != null ? String(data[Fields.sessionId]) : null,
    aidId: data[Fields.aidId] != null ? String(data[Fields.aidId]) : null,
    aidLabel:
      data[Fields.aidLabel] != null ? String(data[Fields.aidLabel]) : null,
    aidAmountCents:
      data[Fields.aidAmountCents] != null
        ? Number(data[Fields.aidAmountCents])
        : null,
    note: data[Fields.note] != null ? String(data[Fields.note]) : null,
  };
}

function paymentEventPayload(params: {
  type: string;
  deltaCents: number;
  amountPaidCentsBefore: number;
  amountPaidCentsAfter: number;
  statusAfter: string;
  actorUid: string;
  offlineMethod?: string | null;
  paidVia?: string | null;
  paymentProvider?: string | null;
  externalPaymentId?: string | null;
  sessionId?: string | null;
  aidId?: string | null;
  aidLabel?: string | null;
  aidAmountCents?: number | null;
  note?: string | null;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    [Fields.type]: params.type,
    [Fields.deltaCents]: params.deltaCents,
    [Fields.amountPaidCentsBefore]: params.amountPaidCentsBefore,
    [Fields.amountPaidCentsAfter]: params.amountPaidCentsAfter,
    [Fields.statusAfter]: params.statusAfter,
    [Fields.actorUid]: params.actorUid,
    [Fields.createdAt]: serverTimestamp(),
  };
  if (params.offlineMethod) payload[Fields.offlineMethod] = params.offlineMethod;
  if (params.paidVia) payload[Fields.paidVia] = params.paidVia;
  if (params.paymentProvider) {
    payload[Fields.paymentProvider] = params.paymentProvider;
  }
  if (params.externalPaymentId) {
    payload[Fields.externalPaymentId] = params.externalPaymentId;
  }
  if (params.sessionId) payload[Fields.sessionId] = params.sessionId;
  if (params.aidId) payload[Fields.aidId] = params.aidId;
  if (params.aidLabel) payload[Fields.aidLabel] = params.aidLabel;
  if (params.aidAmountCents != null) {
    payload[Fields.aidAmountCents] = params.aidAmountCents;
  }
  if (params.note?.trim()) payload[Fields.note] = params.note.trim();
  return payload;
}

function appendPaymentEvent(
  batch: WriteBatch,
  clubId: string,
  seasonId: string,
  memberId: string,
  payload: Record<string, unknown>,
): void {
  const eventRef = doc(paymentEventsCol(clubId, seasonId, memberId));
  batch.set(eventRef, payload);
}

/** Charge l’historique des transactions d’une fiche (plus récent d’abord). */
export async function listPaymentEvents(params: {
  clubId: string;
  seasonId: string;
  memberId: string;
  limitCount?: number;
}): Promise<FeePaymentEventRecord[]> {
  const { clubId, seasonId, memberId, limitCount = 50 } = params;
  const snap = await getDocs(
    query(
      paymentEventsCol(clubId, seasonId, memberId),
      orderBy(Fields.createdAt, "desc"),
      limit(limitCount),
    ),
  );
  return snap.docs.map((eventDoc) =>
    parsePaymentEvent(
      eventDoc.id,
      eventDoc.data() as Record<string, unknown>,
    ),
  );
}

/** Libellé UI d’un type d’événement ledger. */
export function feePaymentEventTitle(type: string): string {
  switch (type) {
    case FeePaymentEventTypes.offlineCredit:
      return "Paiement hors-ligne";
    case FeePaymentEventTypes.cardCredit:
      return "Paiement CB";
    case FeePaymentEventTypes.adjustAbsolute:
      return "Correction du montant";
    case FeePaymentEventTypes.aidValidated:
      return "Aide validée";
    case FeePaymentEventTypes.aidRejected:
      return "Aide refusée";
    case FeePaymentEventTypes.markedPaid:
      return "Marqué payé";
    case FeePaymentEventTypes.exempted:
      return "Exonération";
    case FeePaymentEventTypes.unexempted:
      return "Fin d’exonération";
    default:
      return "Mouvement";
  }
}

/** Détail UI d’une ligne d’historique. */
export function feePaymentEventDetail(event: FeePaymentEventRecord): string {
  const formatEuros = (cents: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  const signed = (cents: number) =>
    `${cents > 0 ? "+" : ""}${formatEuros(cents)}`;

  const parts: string[] = [];
  switch (event.type) {
    case FeePaymentEventTypes.offlineCredit:
      if (event.deltaCents !== 0) parts.push(signed(event.deltaCents));
      if (event.offlineMethod) {
        parts.push(feePaymentMethodLabelFromOffline(event.offlineMethod));
      }
      break;
    case FeePaymentEventTypes.cardCredit:
      if (event.deltaCents !== 0) parts.push(signed(event.deltaCents));
      if (event.paymentProvider === "stripe") parts.push("Stripe");
      else if (event.paymentProvider === "helloasso") parts.push("HelloAsso");
      else if (event.paymentProvider) parts.push(event.paymentProvider);
      break;
    case FeePaymentEventTypes.adjustAbsolute:
      parts.push(
        `Total payé : ${formatEuros(event.amountPaidCentsAfter)} (${signed(event.deltaCents)})`,
      );
      break;
    case FeePaymentEventTypes.aidValidated:
    case FeePaymentEventTypes.aidRejected:
      if (event.aidLabel?.trim()) parts.push(event.aidLabel.trim());
      if (event.aidAmountCents != null) {
        parts.push(formatEuros(event.aidAmountCents));
      }
      break;
    default:
      if (event.deltaCents !== 0) parts.push(signed(event.deltaCents));
  }
  if (event.note?.trim()) parts.push(event.note.trim());
  return parts.join(" · ");
}

function feePaymentMethodLabelFromOffline(method: string): string {
  switch (method) {
    case "virement":
      return "Virement";
    case "cheque":
      return "Chèque";
    case "especes":
      return "Espèces";
    case "ancv":
      return "Chèques ANCV";
    case "cheques_vacances":
      return "Chèques-vacances";
    default:
      return method;
  }
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
    offlineMethod:
      data[Fields.offlineMethod] != null
        ? String(data[Fields.offlineMethod])
        : null,
    aids: parseAids(data[Fields.aids]),
  };
}

const OFFLINE_METHOD_LABELS: Record<string, string> = {
  virement: "Virement",
  cheque: "Chèque",
  especes: "Espèces",
  ancv: "Chèques ANCV",
  cheques_vacances: "Chèques-vacances",
  carte_bancaire: "Carte bancaire",
};

/**
 * Libellé du moyen de paiement d’une fiche (CB Stripe, hors-ligne, etc.).
 * `null` si aucun encaissement encore enregistré.
 */
export function feePaymentMethodLabel(fee: MemberFeeRecord): string | null {
  if (fee.amountPaidCents <= 0) return null;

  const via = (fee.paidVia ?? "").toLowerCase();
  const provider = (fee.paymentProvider ?? "").toLowerCase();

  if (
    via === FeePaidVia.stripe ||
    provider.includes("stripe") ||
    provider === "carte_bancaire"
  ) {
    return "Carte (Stripe)";
  }
  if (
    via === FeePaidVia.helloasso ||
    via === FeePaidVia.inApp ||
    provider.includes("helloasso")
  ) {
    return "Carte (HelloAsso)";
  }
  if (via === FeePaidVia.offline) {
    const offline = fee.offlineMethod
      ? OFFLINE_METHOD_LABELS[fee.offlineMethod] ?? fee.offlineMethod
      : null;
    return offline ? `Hors-ligne · ${offline}` : "Hors-ligne";
  }
  if (via === FeePaidVia.manual) {
    return "Manuel";
  }
  if (fee.offlineMethod) {
    return OFFLINE_METHOD_LABELS[fee.offlineMethod] ?? fee.offlineMethod;
  }
  if (fee.amountPaidCents > 0) {
    return "Encaissé";
  }
  return null;
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

/** Met à jour uniquement les moyens de paiement d'une saison. */
export async function updateSeasonPaymentMethods(
  clubId: string,
  seasonId: string,
  paymentMethods: FeePaymentMethod[],
): Promise<void> {
  const ref = doc(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.feeSeasons,
    seasonId,
  );
  await updateDoc(ref, {
    [Fields.paymentMethods]: paymentMethods,
    [Fields.updatedAt]: serverTimestamp(),
  });
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

/** Résultat du recalcul de statut cotisation. */
export type MemberFeeStatusResolution = {
  statusValue: string;
  isFullyPaid: boolean;
  clearPaidAt: boolean;
};

/** Montant catalogue pour un palier (0 si exonéré / sans palier). */
export function amountDueCentsForTier(params: {
  season: FeeSeasonRecord;
  tierId: string | null | undefined;
  isExempt: boolean;
}): number {
  const { season, tierId, isExempt } = params;
  if (isExempt || !tierId) return 0;
  const tier = season.tiers.find((item) => item.tierId === tierId);
  return tier?.amountCents ?? 0;
}

/**
 * Recalcule le statut stocké à partir du dû, du payé et des aides.
 * Aligné sur le webhook Stripe et le client Flutter.
 */
export function resolveMemberFeePaymentStatus(params: {
  isExempt: boolean;
  dueCents: number;
  amountPaidCents: number;
  validatedAidsCents: number;
  hasPendingAids: boolean;
}): MemberFeeStatusResolution {
  const {
    isExempt,
    dueCents,
    amountPaidCents,
    validatedAidsCents: validated,
    hasPendingAids,
  } = params;

  if (isExempt) {
    return {
      statusValue: MemberFeeStatuses.exonere,
      isFullyPaid: false,
      clearPaidAt: true,
    };
  }

  const remaining = dueCents - (amountPaidCents + validated);
  if (remaining <= 0 && !hasPendingAids) {
    return {
      statusValue: MemberFeeStatuses.paye,
      isFullyPaid: true,
      clearPaidAt: false,
    };
  }

  if (amountPaidCents > 0 || validated > 0) {
    return {
      statusValue: MemberFeeStatuses.partiel,
      isFullyPaid: false,
      clearPaidAt: true,
    };
  }

  return {
    statusValue: MemberFeeStatuses.aPayer,
    isFullyPaid: false,
    clearPaidAt: true,
  };
}

function feeSeasonRef(clubId: string, seasonId: string) {
  return doc(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.feeSeasons,
    seasonId,
  );
}

/** Charge une saison par id. */
export async function getSeasonById(
  clubId: string,
  seasonId: string,
): Promise<FeeSeasonRecord | null> {
  const snap = await getDoc(feeSeasonRef(clubId, seasonId));
  if (!snap.exists()) return null;
  return parseFeeSeason(snap.id, snap.data() as Record<string, unknown>);
}

/** Début de journée calendaire (minuit local). */
export function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Vrai si deux dates tombent le même jour (local). */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return startOfCalendarDay(a).getTime() === startOfCalendarDay(b).getTime();
}

/** Vrai si aujourd'hui est le jour de l'échéance. */
export function isDeadlineToday(
  deadline: Date | null,
  clock = new Date(),
): boolean {
  if (!deadline) return false;
  return isSameCalendarDay(deadline, clock);
}

/** Vrai si l'échéance est dépassée (strictement après le jour J). */
export function isDeadlineElapsed(
  deadline: Date | null,
  clock = new Date(),
): boolean {
  if (!deadline) return false;
  const end = startOfCalendarDay(deadline);
  const today = startOfCalendarDay(clock);
  return today.getTime() > end.getTime();
}

/** Membre avec cotisation encore due (hors payé / exonéré). */
export function isMemberFeePaymentDue(
  fee: MemberFeeRecord,
  season: FeeSeasonRecord,
): boolean {
  if (
    fee.status === MemberFeeStatuses.paye ||
    fee.status === MemberFeeStatuses.exonere
  ) {
    return false;
  }
  return remainingCents(fee, season) > 0;
}

/** Jour J de l'échéance avec cotisation encore due. */
export function isFeeDeadlineUrgentDay(
  fee: MemberFeeRecord,
  season: FeeSeasonRecord,
  clock = new Date(),
): boolean {
  if (!isMemberFeePaymentDue(fee, season)) return false;
  return isDeadlineToday(season.paymentDeadlineAt, clock);
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
  const resolution = resolveMemberFeePaymentStatus({
    isExempt: fee.status === MemberFeeStatuses.exonere,
    dueCents: amountDueCents(fee, season),
    amountPaidCents: newPaid,
    validatedAidsCents: validatedAidsCents(fee),
    hasPendingAids: fee.aids.some(
      (aid) => aid.status === FeeAidStatuses.pendingProof,
    ),
  });

  const batch = writeBatch(getAppFirestore());
  batch.update(memberFeeRef(clubId, seasonId, memberId), {
    [Fields.amountPaidCents]: newPaid,
    [Fields.offlineMethod]: offlineMethod,
    [Fields.paidVia]: FeePaidVia.offline,
    [Fields.feeStatus]: resolution.statusValue,
    ...(resolution.isFullyPaid
      ? { [Fields.paidAt]: serverTimestamp() }
      : resolution.clearPaidAt
        ? { [Fields.paidAt]: deleteField() }
        : {}),
    [Fields.markedBy]: uid,
    [Fields.updatedAt]: serverTimestamp(),
  });

  if (amountCents > 0) {
    appendPaymentEvent(
      batch,
      clubId,
      seasonId,
      memberId,
      paymentEventPayload({
        type: FeePaymentEventTypes.offlineCredit,
        deltaCents: amountCents,
        amountPaidCentsBefore: fee.amountPaidCents,
        amountPaidCentsAfter: newPaid,
        statusAfter: resolution.statusValue,
        actorUid: uid,
        offlineMethod,
        paidVia: FeePaidVia.offline,
      }),
    );
  }

  await batch.commit();
}

/** Pose le montant déjà encaissé (absolu) et recalcule le statut. */
export async function adjustMemberFeePaidAmount(params: {
  clubId: string;
  seasonId: string;
  memberId: string;
  amountPaidCents: number;
  season: FeeSeasonRecord;
  note?: string | null;
}): Promise<void> {
  const { clubId, seasonId, memberId, amountPaidCents, season, note } = params;
  if (amountPaidCents < 0) throw new Error("Montant invalide");

  const feeRef = memberFeeRef(clubId, seasonId, memberId);
  const snap = await getDoc(feeRef);
  if (!snap.exists()) throw new Error("Fiche cotisation introuvable");

  const fee = parseMemberFee(snap.id, snap.data() as Record<string, unknown>);
  if (fee.status === MemberFeeStatuses.exonere) {
    throw new Error("Membre exonéré — ajustement impossible");
  }
  if (!fee.tierId) {
    throw new Error("Aucune cotisation assignée pour ce membre");
  }

  const resolution = resolveMemberFeePaymentStatus({
    isExempt: false,
    dueCents: amountDueCents(fee, season),
    amountPaidCents,
    validatedAidsCents: validatedAidsCents(fee),
    hasPendingAids: fee.aids.some(
      (aid) => aid.status === FeeAidStatuses.pendingProof,
    ),
  });

  const uid = currentUid();
  const payload: Record<string, unknown> = {
    [Fields.amountPaidCents]: amountPaidCents,
    [Fields.feeStatus]: resolution.statusValue,
    [Fields.markedBy]: uid,
    [Fields.updatedAt]: serverTimestamp(),
    ...(resolution.isFullyPaid
      ? { [Fields.paidAt]: serverTimestamp() }
      : resolution.clearPaidAt
        ? { [Fields.paidAt]: deleteField() }
        : {}),
  };

  if (amountPaidCents === 0) {
    payload[Fields.paidVia] = deleteField();
    payload[Fields.offlineMethod] = deleteField();
    payload[Fields.paymentProvider] = deleteField();
  } else if (amountPaidCents !== fee.amountPaidCents) {
    payload[Fields.paidVia] = FeePaidVia.manual;
    payload[Fields.offlineMethod] = deleteField();
    payload[Fields.paymentProvider] = deleteField();
  }

  const trimmedNote = note?.trim();
  if (trimmedNote) {
    const previousRaw = (snap.data() as Record<string, unknown>)[
      Fields.notesAdmin
    ];
    const previous =
      typeof previousRaw === "string" ? previousRaw.trim() : "";
    payload[Fields.notesAdmin] = previous
      ? `${previous}\n${trimmedNote}`
      : trimmedNote;
  }

  const batch = writeBatch(getAppFirestore());
  batch.update(feeRef, payload);

  if (amountPaidCents !== fee.amountPaidCents) {
    appendPaymentEvent(
      batch,
      clubId,
      seasonId,
      memberId,
      paymentEventPayload({
        type: FeePaymentEventTypes.adjustAbsolute,
        deltaCents: amountPaidCents - fee.amountPaidCents,
        amountPaidCentsBefore: fee.amountPaidCents,
        amountPaidCentsAfter: amountPaidCents,
        statusAfter: resolution.statusValue,
        actorUid: uid,
        paidVia: amountPaidCents === 0 ? null : FeePaidVia.manual,
        note: trimmedNote,
      }),
    );
  }

  await batch.commit();
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
  const hasPendingAids = updatedAids.some(
    (aid) => aid.status === FeeAidStatuses.pendingProof,
  );
  const resolution = resolveMemberFeePaymentStatus({
    isExempt: fee.status === MemberFeeStatuses.exonere,
    dueCents: amountDueCents(fee, season),
    amountPaidCents: fee.amountPaidCents,
    validatedAidsCents: validatedAids,
    hasPendingAids,
  });

  const touchedAid = fee.aids.find((aid) => aid.id === aidId);
  const batch = writeBatch(getAppFirestore());
  batch.update(memberFeeRef(clubId, seasonId, memberId), {
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
    [Fields.feeStatus]: resolution.statusValue,
    ...(resolution.isFullyPaid
      ? { [Fields.paidAt]: serverTimestamp() }
      : resolution.clearPaidAt
        ? { [Fields.paidAt]: deleteField() }
        : {}),
    [Fields.markedBy]: uid,
    [Fields.updatedAt]: serverTimestamp(),
  });

  if (touchedAid) {
    appendPaymentEvent(
      batch,
      clubId,
      seasonId,
      memberId,
      paymentEventPayload({
        type:
          aidStatus === FeeAidStatuses.validated
            ? FeePaymentEventTypes.aidValidated
            : FeePaymentEventTypes.aidRejected,
        deltaCents: 0,
        amountPaidCentsBefore: fee.amountPaidCents,
        amountPaidCentsAfter: fee.amountPaidCents,
        statusAfter: resolution.statusValue,
        actorUid: uid,
        aidId: touchedAid.id,
        aidLabel: touchedAid.label,
        aidAmountCents: touchedAid.amountCents,
      }),
    );
  }

  await batch.commit();
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

  const existing = parseMemberFee(
    snap.id,
    snap.data() as Record<string, unknown>,
  );
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

  const batch = writeBatch(getAppFirestore());
  batch.update(feeRef, payload);

  const eventType =
    status === MemberFeeStatuses.exonere
      ? FeePaymentEventTypes.exempted
      : status === MemberFeeStatuses.paye
        ? FeePaymentEventTypes.markedPaid
        : existing.status === MemberFeeStatuses.exonere
          ? FeePaymentEventTypes.unexempted
          : null;
  if (eventType) {
    appendPaymentEvent(
      batch,
      clubId,
      seasonId,
      memberId,
      paymentEventPayload({
        type: eventType,
        deltaCents: 0,
        amountPaidCentsBefore: existing.amountPaidCents,
        amountPaidCentsAfter: existing.amountPaidCents,
        statusAfter: status,
        actorUid: uid,
        paidVia: FeePaidVia.manual,
      }),
    );
  }

  await batch.commit();
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
 * Un changement de palier (ou statut `a_payer`) recalcule le statut selon le déjà payé.
 */
export async function applyMemberFeeChanges(params: {
  clubId: string;
  seasonId: string;
  changes: MemberFeeApplyChange[];
}): Promise<void> {
  const { clubId, seasonId, changes } = params;
  if (changes.length === 0) return;

  const season = await getSeasonById(clubId, seasonId);
  if (!season) throw new Error("Saison de cotisation introuvable");

  const uid = currentUid();
  const db = getAppFirestore();
  const maxBatch = 200;
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
      const requestedStatus = change.status;
      const isExemptRequest = requestedStatus === MemberFeeStatuses.exonere;
      const wasExempt = existing?.status === MemberFeeStatuses.exonere;

      if (
        !nextTierId &&
        requestedStatus &&
        !assignableWithoutTier.has(requestedStatus)
      ) {
        throw new Error(
          "Sans cotisation assignée, seul le statut Exonéré est autorisé",
        );
      }

      if (!change.feeExists) {
        const createExempt = isExemptRequest;
        const createStatus = createExempt
          ? MemberFeeStatuses.exonere
          : resolveMemberFeePaymentStatus({
              isExempt: false,
              dueCents: amountDueCentsForTier({
                season,
                tierId: nextTierId,
                isExempt: false,
              }),
              amountPaidCents: 0,
              validatedAidsCents: 0,
              hasPendingAids: false,
            }).statusValue;
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
        if (createStatus === MemberFeeStatuses.exonere) {
          appendPaymentEvent(
            batch,
            clubId,
            seasonId,
            change.memberId,
            paymentEventPayload({
              type: FeePaymentEventTypes.exempted,
              deltaCents: 0,
              amountPaidCentsBefore: 0,
              amountPaidCentsAfter: 0,
              statusAfter: createStatus,
              actorUid: uid,
              paidVia: FeePaidVia.manual,
            }),
          );
        }
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

      const shouldRecalc =
        change.tierId !== undefined ||
        requestedStatus === MemberFeeStatuses.aPayer ||
        isExemptRequest;

      let statusAfter = existing?.status ?? MemberFeeStatuses.aPayer;

      if (shouldRecalc) {
        const resolution = resolveMemberFeePaymentStatus({
          isExempt: isExemptRequest,
          dueCents: amountDueCentsForTier({
            season,
            tierId: nextTierId,
            isExempt: isExemptRequest,
          }),
          amountPaidCents: existing?.amountPaidCents ?? 0,
          validatedAidsCents: existing ? validatedAidsCents(existing) : 0,
          hasPendingAids:
            existing?.aids.some(
              (aid) => aid.status === FeeAidStatuses.pendingProof,
            ) ?? false,
        });
        updatePayload[Fields.feeStatus] = resolution.statusValue;
        statusAfter = resolution.statusValue;
        if (isExemptRequest) {
          updatePayload[Fields.paidVia] = FeePaidVia.manual;
          updatePayload[Fields.paidAt] = deleteField();
          if (change.tierId === undefined) {
            updatePayload[Fields.tierId] = deleteField();
          }
        } else if (resolution.isFullyPaid) {
          updatePayload[Fields.paidAt] = serverTimestamp();
        } else if (resolution.clearPaidAt) {
          updatePayload[Fields.paidAt] = deleteField();
        }
      }

      batch.set(feeRef, updatePayload, { merge: true });

      if (isExemptRequest) {
        appendPaymentEvent(
          batch,
          clubId,
          seasonId,
          change.memberId,
          paymentEventPayload({
            type: FeePaymentEventTypes.exempted,
            deltaCents: 0,
            amountPaidCentsBefore: existing?.amountPaidCents ?? 0,
            amountPaidCentsAfter: existing?.amountPaidCents ?? 0,
            statusAfter,
            actorUid: uid,
            paidVia: FeePaidVia.manual,
          }),
        );
      } else if (wasExempt && change.tierId) {
        appendPaymentEvent(
          batch,
          clubId,
          seasonId,
          change.memberId,
          paymentEventPayload({
            type: FeePaymentEventTypes.unexempted,
            deltaCents: 0,
            amountPaidCentsBefore: existing?.amountPaidCents ?? 0,
            amountPaidCentsAfter: existing?.amountPaidCents ?? 0,
            statusAfter,
            actorUid: uid,
          }),
        );
      }
    }

    await batch.commit();
  }
}
