/** Feature flags portail (alignés sur l’app Flutter). */

/** Paiement CB HelloAsso live (partenariat + secrets déployés). */
export const HELLOASSO_PAYMENTS_LIVE =
  process.env.NEXT_PUBLIC_HELLOASSO_LIVE === "true";
