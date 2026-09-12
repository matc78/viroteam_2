/** Part Stripe % (cartes EEE standard). */
export const STRIPE_PERCENT = 0.015;
/** Part Stripe fixe en centimes. */
export const STRIPE_FIXED_CENTS = 25;
/** Marge plateforme fixe en centimes (sécurité + revenu). */
export const PLATFORM_FLAT_CENTS = 100;

/**
 * Convertit un montant net club (centimes) en montant brut CB membre.
 * Formule : gross = (net + fixeStripe + margePlateforme) / (1 − %)
 * Arrondi au centime supérieur pour ne pas laisser la plateforme dans le rouge.
 */
export function cardGrossCentsFromNet(netCents: number): number {
  const net = Math.max(0, Math.round(netCents));
  if (net <= 0) return 0;
  const fixedEuros = (STRIPE_FIXED_CENTS + PLATFORM_FLAT_CENTS) / 100;
  const grossEuros = (net / 100 + fixedEuros) / (1 - STRIPE_PERCENT);
  return Math.ceil(grossEuros * 100);
}

/**
 * Frais CB affichés (brut − net) pour un montant net club.
 */
export function cardFeeCentsFromNet(netCents: number): number {
  const net = Math.max(0, Math.round(netCents));
  if (net <= 0) return 0;
  return cardGrossCentsFromNet(net) - net;
}
