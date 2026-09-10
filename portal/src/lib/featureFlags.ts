/** Feature flags portail (alignés sur l’app Flutter). */

/** Paiement CB HelloAsso live (partenariat + secrets déployés) — dormant. */
export const HELLOASSO_PAYMENTS_LIVE =
  process.env.NEXT_PUBLIC_HELLOASSO_LIVE === "true";

/** Paiement CB Stripe Connect live (secrets Functions + onboarding club). */
export const STRIPE_PAYMENTS_LIVE =
  process.env.NEXT_PUBLIC_STRIPE_LIVE === "true";
