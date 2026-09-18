/** Feature flags portail (alignés sur l’app Flutter). */

/** Paiement CB HelloAsso live (partenariat + secrets déployés) — dormant. */
export const HELLOASSO_PAYMENTS_LIVE =
  process.env.NEXT_PUBLIC_HELLOASSO_LIVE === "true";

/** Paiement CB Stripe Connect live (secrets Functions + onboarding club). */
export const STRIPE_PAYMENTS_LIVE =
  process.env.NEXT_PUBLIC_STRIPE_LIVE === "true";

/**
 * Messagerie in-app (dock, `/messages`, prefs push chat).
 * Off tant que la feature n’est pas déployée sur l’app store (CHANGELOG Unreleased).
 * Activer en local : `NEXT_PUBLIC_CHAT_MESSAGING_LIVE=true`.
 */
export const CHAT_MESSAGING_LIVE =
  process.env.NEXT_PUBLIC_CHAT_MESSAGING_LIVE === "true";
