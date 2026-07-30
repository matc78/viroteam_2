# Roadmap ViroTeam v2

Plan global priorisé. Cocher au fil de l’eau.

**Décisions figées**

- **Paiement** : HelloAsso (Checkout Intent) via `PaymentService` / `HelloAssoPaymentService`. Modes hybrides (3×, aides, hors-ligne). Validation CB **uniquement** via webhook. Spec : [`docs/specs/viroteam_v2_payments_helloasso_spec.md`](specs/viroteam_v2_payments_helloasso_spec.md).
- **Calendrier** : page d’aide (étapes manuelles iOS/Android) + bouton d’ajout natif.
- **Tournois / championnats** : retirés du produit (UI, copy, actions).

Specs produit : [`docs/specs/`](specs/).

---

## Phase 0 — Document et cadrage

- [x] Ce fichier `docs/ROADMAP.md`
- [x] Chemins specs alignés (`docs/specs/` dans README / `project_config`)

## Phase 1 — Retrait tournois / championnats

- [x] Copy onboarding / wizard
- [x] Retirer action « Gérer les tournois »
- [x] Ne plus proposer le type à la création d’événement (compat lecture seule)
- [x] Objectif club `tournaments` retiré de la sélection

## Phase 2 — Compte, profil, stubs

- [x] Écran Profil (`/profile`) + déconnexion
- [x] Icône user home → profil
- [x] Cacher settings club morts
- [x] Remplacer `Icons.*` sur écrans touchés

## Phase 3 — Cotisations + paiement abstrait

- [x] UX admin simplifiée (saison, paliers, liste, hors-app en secondaire)
- [x] Découpage onglet Membres (`fee_members_tracking_tab.dart`)
- [x] `PaymentService` + HelloAsso
- [x] Champs paiement sur `MemberFee` + CTA membre

## Phase 4 — Calendrier téléphone

- [x] Page d’aide manuelle + export `.ics`
- [x] Bouton ajout natif (permission)
- [x] Entrées depuis détail événement / planning

## Phase 5 — Sécurité Firestore + Functions

- [x] Rules resserrées (invitations, events RSVP, users list)
- [x] Scaffold `functions/` (invitations, webhook paiement)

## Phase 6 — Qualité UX / technique

- [x] `ViroEmptyState` / `ViroErrorState`
- [x] Deep link `/join?code=`
- [x] Crashlytics
- [x] RSVP invalidate + feedback erreur
- [x] CI `analyze` + `test`

## Phase 7 — Paiements hybrides HelloAsso

- [x] Spec `viroteam_v2_payments_helloasso_spec.md`
- [x] Modèle hybride (`amountPaidCents`, `aids`, `partiel`, hors-ligne)
- [x] Callable `createHelloAssoCheckout` (1× / 3× + aides)
- [x] Webhook `helloAssoWebhook` + reçu PDF
- [x] UI membre (sheet checkout) + UI trésorier (hors-ligne / justificatifs)
- [ ] Déployer secrets HelloAsso + slug orga par club
- [ ] Brancher `acceptInvitation` côté client
- [ ] Upload photo justificatif d’aide (v2)

## Phase 8 — Backlog

- [ ] Parcours parent bout-en-bout
- [ ] FCM (token, push rappels)

---

## Hors scope immédiat

- Multi-prestataires (Stripe en parallèle)
- Module tournois
- Abonnement calendrier serveur permanent
- Dark mode / i18n multi-langue
