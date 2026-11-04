/** Feature flags portail (alignés sur l’app Flutter). */

/** Paiement CB HelloAsso live (partenariat + secrets déployés) — dormant. */
export const HELLOASSO_PAYMENTS_LIVE =
  process.env.NEXT_PUBLIC_HELLOASSO_LIVE === "true";

/** Paiement CB Stripe Connect live (secrets Functions + Connect club). */
export const STRIPE_PAYMENTS_LIVE =
  process.env.NEXT_PUBLIC_STRIPE_LIVE === "true";

/**
 * Messagerie forcée en local (build) : `NEXT_PUBLIC_CHAT_MESSAGING_LIVE=true`.
 * En prod App Hosting la variable est absente — l’accès passe par
 * `users/{uid}.flags.chatMessaging` via [`isChatMessagingLive`].
 */
export const CHAT_MESSAGING_LIVE =
  process.env.NEXT_PUBLIC_CHAT_MESSAGING_LIVE === "true";

/**
 * Messagerie visible : env local **ou** flag profil
 * `users/{uid}.flags.chatMessaging`.
 */
export function isChatMessagingLive(
  profile?: { chatMessaging?: boolean } | null,
): boolean {
  return CHAT_MESSAGING_LIVE || profile?.chatMessaging === true;
}
