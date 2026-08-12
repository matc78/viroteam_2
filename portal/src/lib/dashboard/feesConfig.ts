import type { ClubRecord } from "@/lib/firebase/clubService";
import type {
  FeePaymentMethod,
  FeeSeasonRecord,
  FeeTier,
} from "@/lib/firebase/feeService";
import { formatDateInput } from "@/lib/firebase/feeService";

export type { FeePaymentMethod } from "@/lib/firebase/feeService";

/** Palier tarifaire pour le formulaire cotisations. */
export type FeeTierDraft = {
  id: string;
  label: string;
  /** Montant en centimes. */
  amountCents: number;
};

/** Config cotisations (saison + HelloAsso) pour le formulaire. */
export type FeesConfig = {
  seasonId: string | null;
  seasonLabel: string;
  currency: string;
  /** ISO date `YYYY-MM-DD` ou chaîne vide. */
  paymentDeadline: string;
  paymentInstructions: string;
  iban: string;
  paymentMethods: FeePaymentMethod[];
  tiers: FeeTierDraft[];
  onlinePaymentEnabled: boolean;
  helloAssoOrganizationSlug: string;
};

export const FEE_PAYMENT_METHOD_OPTIONS: {
  id: FeePaymentMethod;
  label: string;
}[] = [
  { id: "carte_bancaire", label: "Carte bancaire (HelloAsso)" },
  { id: "virement", label: "Virement" },
  { id: "cheque", label: "Chèque" },
  { id: "especes", label: "Espèces" },
  { id: "ancv", label: "Chèques ANCV" },
  { id: "cheques_vacances", label: "Chèques-vacances" },
];

/** Saisons scolaires / sportives proposées (année N–N+1). */
export function buildSeasonLabelOptions(aroundYear = new Date().getFullYear()): string[] {
  const start = aroundYear - 1;
  return Array.from({ length: 4 }, (_, index) => {
    const from = start + index;
    return `${from}-${from + 1}`;
  });
}

export const FEE_CURRENCY_OPTIONS = [
  { id: "EUR", label: "Euro (€)" },
] as const;

export type FeeCurrency = (typeof FEE_CURRENCY_OPTIONS)[number]["id"];

/** Convertit les tiers formulaire vers le modèle Firestore. */
export function tiersDraftToFeeTiers(tiers: FeeTierDraft[]): FeeTier[] {
  return tiers.map((tier) => ({
    tierId: tier.id,
    label: tier.label.trim(),
    amountCents: tier.amountCents,
  }));
}

/** Config vide pour création de saison. */
export function emptyFeesConfig(params: {
  onlinePaymentEnabled?: boolean;
  helloAssoOrganizationSlug?: string;
}): FeesConfig {
  const seasonOptions = buildSeasonLabelOptions();
  return {
    seasonId: null,
    seasonLabel: seasonOptions[1] ?? seasonOptions[0] ?? "",
    currency: "EUR",
    paymentDeadline: "",
    paymentInstructions: "",
    iban: "",
    paymentMethods: ["virement", "cheque", "especes"],
    tiers: [{ id: `tier_${Date.now()}`, label: "Standard", amountCents: 0 }],
    onlinePaymentEnabled: params.onlinePaymentEnabled ?? false,
    helloAssoOrganizationSlug: params.helloAssoOrganizationSlug ?? "",
  };
}

/** Mappe une saison Firestore vers la config formulaire cotisations. */
export function seasonRecordToFeesConfig(
  season: FeeSeasonRecord,
  club: ClubRecord,
): FeesConfig {
  return {
    seasonId: season.id,
    seasonLabel: season.seasonLabel,
    currency: season.currency || "EUR",
    paymentDeadline: formatDateInput(season.paymentDeadlineAt),
    paymentInstructions: season.paymentInstructions,
    iban: season.iban,
    paymentMethods: season.paymentMethods,
    tiers: season.tiers.map((tier) => ({
      id: tier.tierId || `tier_${tier.label}`,
      label: tier.label,
      amountCents: tier.amountCents,
    })),
    onlinePaymentEnabled: club.onlinePaymentEnabled,
    helloAssoOrganizationSlug: club.helloAssoOrganizationSlug,
  };
}
