/**
 * Paiement CB envoyé mais pas encore crédité par le webhook Stripe.
 * Tant qu’il est en attente, la cotisation concernée ne propose pas de
 * second paiement. Logique pure (testée par vitest) + persistance best-effort.
 */

/** Durée max d’attente du webhook avant de reproposer le paiement. */
export const PENDING_FEE_PAYMENT_TTL_MS = 15 * 60 * 1000;

const STORAGE_KEY = "viro.pendingFeePayments";

/** Cotisation visée : club, saison, fiche membre. */
export type FeePaymentKey = {
  clubId: string;
  seasonId: string;
  memberId: string;
};

/** Paiement envoyé, en attente de validation serveur. */
export type PendingFeePayment = FeePaymentKey & {
  /** Reste dû au moment du paiement (centimes). */
  remainingCents: number;
  /** Horodatage de l’envoi (ms epoch). */
  submittedAt: number;
};

/** Identifiant stable d’une cotisation. */
export function feePaymentKeyId(key: FeePaymentKey): string {
  return `${key.clubId}/${key.seasonId}/${key.memberId}`;
}

/**
 * True si un paiement attend encore sa validation pour cette cotisation :
 * même cotisation, reste dû inchangé (webhook pas encore passé) et délai
 * d’attente non écoulé.
 */
export function isFeePaymentPending(
  pending: PendingFeePayment | null | undefined,
  key: FeePaymentKey | null,
  currentRemainingCents: number,
  now: number,
): boolean {
  if (!pending || !key) return false;
  if (feePaymentKeyId(pending) !== feePaymentKeyId(key)) return false;
  if (currentRemainingCents <= 0) return false;
  if (currentRemainingCents !== pending.remainingCents) return false;
  return now - pending.submittedAt < PENDING_FEE_PAYMENT_TTL_MS;
}

/** Lit les paiements en attente (sessionStorage, vide si indisponible). */
export function readPendingFeePayments(): Record<string, PendingFeePayment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, PendingFeePayment>)
      : {};
  } catch {
    return {};
  }
}

/** Enregistre un paiement en attente (best-effort). */
export function writePendingFeePayment(pending: PendingFeePayment): void {
  if (typeof window === "undefined") return;
  try {
    const all = readPendingFeePayments();
    all[feePaymentKeyId(pending)] = pending;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore : l’état en mémoire suffit pour la session courante.
  }
}
