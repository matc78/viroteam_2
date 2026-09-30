/**
 * Helpers purs du checkout CB (aucune dépendance firebase-admin, testables
 * avec `node --test`).
 *
 * Décision (revue sécurité, 28 sept. 2026) : le montant et la devise envoyés
 * par le client ne font plus foi. Le serveur recalcule le reste dû depuis la
 * fiche `member_fees` (palier dû − déjà payé − aides validées) ; le montant
 * client ne sert qu'à un paiement **partiel** borné par ce reste dû. La devise
 * est toujours `eur`.
 */

/** Seule devise acceptée (checkout et webhook). */
export const CHECKOUT_CURRENCY = "eur";

/** Plafond d'aides déclarées par checkout. */
export const MAX_AIDS_PER_CHECKOUT = 10;

/** Types d'aides connus (aligné `aidLabel`). */
const KNOWN_AID_TYPES = new Set(["pass_sport", "pass_plus", "ancv", "promo", "other"]);

export type AidInput = {
  type?: unknown;
  amountCents?: unknown;
  promoCode?: unknown;
  label?: unknown;
};

export type NormalizedAid = {
  type: string;
  amountCents: number;
  promoCode: string | null;
  label: string | null;
};

/**
 * Reste dû d'une cotisation en centimes (jamais négatif).
 * `exonere` → 0. Les aides `pending_proof` ne réduisent pas le reste dû :
 * elles ne sont créditées qu'une fois validées par l'admin.
 */
export function remainingDueCents(params: {
  tierAmountCents: number | undefined;
  feeStatus: string | undefined;
  amountPaidCents: unknown;
  aids: unknown;
}): number {
  if (params.feeStatus === "exonere") return 0;
  const due = Math.max(0, Math.round(Number(params.tierAmountCents ?? 0) || 0));
  const paid = Math.max(0, Math.round(Number(params.amountPaidCents ?? 0) || 0));
  const aids = Array.isArray(params.aids) ? params.aids : [];
  const validated = aids
    .filter(
      (a): a is { status?: unknown; amountCents?: unknown } =>
        !!a && typeof a === "object" && (a as { status?: unknown }).status === "validated",
    )
    .reduce((sum, a) => sum + Math.max(0, Math.round(Number(a.amountCents ?? 0) || 0)), 0);
  return Math.max(0, due - paid - validated);
}

/**
 * Montant net à encaisser : `min(clientNet, resteDû)`.
 * Retourne 0 si le client ne demande rien (parcours « aides seules »).
 */
export function boundedNetCents(clientAmountCents: unknown, remainingCents: number): number {
  const client = Number(clientAmountCents ?? 0);
  if (!Number.isFinite(client) || client <= 0) return 0;
  return Math.max(0, Math.min(Math.round(client), Math.max(0, Math.round(remainingCents))));
}

/**
 * Nettoie les aides déclarées : montants entiers > 0, type connu (sinon
 * `other`), plafond [MAX_AIDS_PER_CHECKOUT], et chaque aide bornée au reste dû.
 */
export function normalizeAidInputs(raw: unknown, remainingCents: number): NormalizedAid[] {
  if (!Array.isArray(raw)) return [];
  const cap = Math.max(0, Math.round(remainingCents));
  const out: NormalizedAid[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const aid = item as AidInput;
    const amount = Math.round(Number(aid.amountCents ?? 0));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const rawType = typeof aid.type === "string" ? aid.type.trim() : "";
    const type = KNOWN_AID_TYPES.has(rawType) ? rawType : "other";
    const promoCode =
      typeof aid.promoCode === "string" && aid.promoCode.trim()
        ? aid.promoCode.trim().slice(0, 64)
        : null;
    const label =
      typeof aid.label === "string" && aid.label.trim()
        ? aid.label.trim().slice(0, 80)
        : null;
    out.push({ type, amountCents: Math.min(amount, cap), promoCode, label });
    if (out.length >= MAX_AIDS_PER_CHECKOUT) break;
  }
  return out.filter((a) => a.amountCents > 0);
}

/**
 * Fusionne les aides d'une session dans `member_fees.aids` : les entrées
 * déjà présentes pour cette session (retry du checkout) sont remplacées,
 * jamais dupliquées. L'id d'une aide est `${sessionId}_${index}`.
 */
export function mergeFeeAids(
  existing: unknown,
  incoming: Record<string, unknown>[],
  sessionId: string,
): Record<string, unknown>[] {
  const prefix = `${sessionId}_`;
  const kept = (Array.isArray(existing) ? existing : []).filter(
    (a): a is Record<string, unknown> =>
      !!a &&
      typeof a === "object" &&
      !String((a as { id?: unknown }).id ?? "").startsWith(prefix),
  );
  return [...kept, ...incoming];
}
