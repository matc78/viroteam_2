import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import { Collections, Fields } from "./constants";
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

/** Fiche cotisation membre. */
export type MemberFeeRecord = {
  id: string;
  status: string;
  amountPaidCents: number;
  paidAt: Date | null;
  paidVia: string | null;
  paymentProvider: string | null;
  aids: Array<Record<string, unknown>>;
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
    .map((item) => ({
      tierId: String(item[Fields.tierId] ?? ""),
      label: String(item[Fields.label] ?? ""),
      amountCents: Number(item[Fields.amountCents] ?? 0),
    }));
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

/** Parse un document member_fees. */
export function parseMemberFee(
  id: string,
  data: Record<string, unknown>,
): MemberFeeRecord {
  const aidsRaw = data[Fields.aids];
  return {
    id,
    status: String(data[Fields.feeStatus] ?? "a_payer"),
    amountPaidCents: Number(data[Fields.amountPaidCents] ?? 0),
    paidAt: toDate(data[Fields.paidAt]),
    paidVia: data[Fields.paidVia] != null ? String(data[Fields.paidVia]) : null,
    paymentProvider:
      data[Fields.paymentProvider] != null
        ? String(data[Fields.paymentProvider])
        : null,
    aids: Array.isArray(aidsRaw)
      ? aidsRaw.filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object",
        )
      : [],
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
  return tiers.map((tier) => ({
    [Fields.tierId]: tier.tierId,
    [Fields.label]: tier.label,
    [Fields.amountCents]: tier.amountCents,
  }));
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
