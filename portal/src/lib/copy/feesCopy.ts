/**
 * Catalogue FR — cotisations côté payeur (portail : joueur, famille).
 * Registre sobre : pas d’humour sur le paiement.
 */
export const feesCopy = {
  /** Paiement envoyé, webhook Stripe pas encore passé. */
  paymentPendingTitle: "Paiement en cours de validation",
  paymentPendingText:
    "Ton paiement a bien été envoyé. Le statut se met à jour dès que la banque confirme, en général en quelques instants.",
  /** Paiement bloqué pendant un rechargement des données. */
  payButtonRefreshing: "Mise à jour…",
} as const;
