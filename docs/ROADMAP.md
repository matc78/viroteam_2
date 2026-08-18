# Roadmap ViroTeam v2

Plan global priorisé. Cocher au fil de l’eau.

**Décisions figées**

- **Paiement** : HelloAsso (Checkout Intent) via `PaymentService` / `HelloAssoPaymentService`. Modes hybrides (3×, aides, hors-ligne). Validation CB **uniquement** via webhook. Spec : [`docs/specs/viroteam_v2_payments_helloasso_spec.md`](specs/viroteam_v2_payments_helloasso_spec.md).
- **Calendrier** : page d’aide (étapes manuelles iOS/Android) + bouton d’ajout natif.
- **Tournois / championnats** : retirés du produit mobile (UI, copy, actions). Module web éventuel plus tard.
- **Portail web** : React (landing + dashboard admin ; espace famille parent en Phase 8). Au MVP bureau, admin = trésorier. Spec : [`docs/specs/viroteam_v2_web_portal_spec.md`](specs/viroteam_v2_web_portal_spec.md).
- **Parents** : relation (`guardians` + `parentLinks`), pas un rôle club. V1 = 1 adulte actif par enfant, N enfants par parent. Invitation admin, compte Auth de l’adulte, actions sur le `memberId` de l’enfant. Spec : [`docs/specs/viroteam_v2_parents_spec.md`](specs/viroteam_v2_parents_spec.md).

**Séquence produit**

1. Finir tout ce qu’il faut pour que l’app soit prête (phases restantes, polish, déploiement).
2. Ensuite devenir partenaire HelloAsso pour activer / finaliser les paiements en ligne en conditions réelles.

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
- [ ] Déployer secrets HelloAsso + slug orga par club *(après partenariat HelloAsso — voir séquence produit)*
- [ ] Brancher `acceptInvitation` côté client
- [ ] Upload photo justificatif d’aide (v2)

## Phase 8 — Parents (espace famille)

Cadrage : [`docs/specs/viroteam_v2_parents_spec.md`](specs/viroteam_v2_parents_spec.md).  
V1 : 1 guardian actif par enfant ; N enfants par parent. Hors V1 : 2ᵉ adulte, compte enfant, FCM.

- [x] Spec cadrage `viroteam_v2_parents_spec.md` + constantes `project_config` / `firestore_fields`
- [x] Modèle `guardians/{parentUid}` + `parentLinks` `{ clubId, memberId, relation, status }`
- [x] Callable `linkGuardian` / acceptation invitation `type: guardian` (écriture des deux faces)
- [x] Invitation admin sur fiche joueur (plafond 1 `active`/`pending`)
- [x] Accueil famille app : planning, RSVP, cotisation, annonces (puces si plusieurs enfants)
- [x] Segment **Moi | enfant** seulement si l’adulte est aussi licencié du club
- [x] Espace famille portail (garde admin **ou** guardian ; nav distincte du bureau)
- [x] RSVP + checkout HelloAsso au nom du `memberId` enfant (rules + callable)
- [ ] FCM (token, push rappels) — backlog, pas bloquant parents V1

## Phase 9 — Portail web + allègement mobile

- [x] Spec cadrage `viroteam_v2_web_portal_spec.md`
- [x] Landing React (sans pricing)
- [x] Login + dashboard admin (membres, cotisations, planning, home)
- [x] Liens app → portail (tuile Espace club, bannières, deep link `?clubId=`)
- [x] Alléger écran cotisations admin mobile (suivi seulement, config → portail)
- [x] Suivi cotisations portail (paiement hors-ligne, validation aides)
- [ ] Inventaire équipements (CRUD simple)
- [ ] Matrice droits coachs (web) + lecture app
- [x] Espace famille parent (voir Phase 8) — garde et nav distinctes du bureau admin

## Phase 10 — Partenariat HelloAsso (paiements en ligne live)

Partenariat en cours — flags `helloAssoPaymentsLive` (app) et `NEXT_PUBLIC_HELLOASSO_LIVE` (portail) à `false` tant que non activé.

- [ ] Devenir partenaire HelloAsso
- [ ] Brancher l’orga / secrets en prod et valider le parcours paiement en ligne bout-en-bout
- [ ] Activer les checkouts CB réels pour les clubs (`helloAssoPaymentsLive = true`)

---

## Hors scope immédiat

- Multi-prestataires (Stripe en parallèle)
- Module tournois (mobile ; web post-MVP)
- Rôle `treasurer` distinct (MVP : admin = trésorier)
- Abonnement / pricing portail
- Abonnement calendrier serveur permanent
- Dark mode / i18n multi-langue
- 2ᵉ parent / grands-parents (schéma prêt, plafond V1 = 1)
- Compte Auth de l’enfant et relais RSVP (hors parents V1)
