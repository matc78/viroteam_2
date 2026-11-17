/**
 * Lecture du webhook HelloAsso (code dormant, conservé pour un passage futur
 * à HelloAsso) — fonctions pures, testables avec `node --test`.
 *
 * Revue (17 nov. 2026) : un événement `Order` en 3 fois portait `amount` sous
 * forme d'objet (`{ total, … }`) → `NaN` → repli sur le montant de session,
 * donc le total crédité dès la 1re échéance ; un `state` vide valait
 * « autorisé ». Désormais seuls les paiements individuellement autorisés, au
 * montant numérique explicite, sont crédités, chacun sous son propre id
 * (un `Payment` rejoué après l'`Order` est idempotent).
 */

/** Paiement HelloAsso à créditer (montant en centimes). */
export type HelloAssoCredit = {
  externalPaymentId: string;
  amountCents: number;
};

/** True si l'état HelloAsso est explicitement autorisé (`Authorized…`). */
export function helloAssoStateAuthorized(state: unknown): boolean {
  const normalized = String(state ?? "").trim().toLowerCase();
  return normalized.length > 0 && normalized.includes("authoriz");
}

/** Montant entier strictement positif, sinon `null` (objet, texte, NaN…). */
function positiveCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const cents = Math.round(value);
  return cents > 0 ? cents : null;
}

function paymentCredit(payment: Record<string, unknown>): HelloAssoCredit | null {
  if (!helloAssoStateAuthorized(payment.state ?? payment.paymentState)) return null;
  const amountCents = positiveCents(payment.amount);
  const id = String(payment.id ?? "").trim();
  if (amountCents == null || !id) return null;
  return { externalPaymentId: id, amountCents };
}

/**
 * Paiements à créditer pour un événement webhook :
 * - `Payment` : le paiement lui-même s'il est autorisé ;
 * - `Order` : chaque entrée autorisée de `payments[]` (jamais le total de
 *   la commande, qui inclut les échéances futures).
 * Tout autre type → aucun crédit.
 */
export function helloAssoCreditsFromWebhook(
  eventType: string,
  data: Record<string, unknown>,
): HelloAssoCredit[] {
  if (eventType === "Payment") {
    const credit = paymentCredit(data);
    return credit ? [credit] : [];
  }
  if (eventType === "Order") {
    const payments = Array.isArray(data.payments) ? data.payments : [];
    return payments
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map(paymentCredit)
      .filter((credit): credit is HelloAssoCredit => credit != null);
  }
  return [];
}
