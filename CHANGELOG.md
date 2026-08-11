# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Versioning Sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- FVM : Flutter 3.44.8 épiné pour ce repo (SDK global boulot inchangé)
- Roadmap produit : [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Écran profil + déconnexion
- Sync calendrier (aide manuelle + ajout natif + export `.ics`)
- Paiements hybrides HelloAsso (1×/3×, aides Pass'Sport/ANCV, hors-ligne, webhook, PDF)
- Spec [`docs/specs/viroteam_v2_payments_helloasso_spec.md`](docs/specs/viroteam_v2_payments_helloasso_spec.md)
- Cloud Functions (`createHelloAssoCheckout`, `helloAssoWebhook`, `acceptInvitation`)
- CI GitHub Actions (`analyze` + `test`)
- `ViroEmptyState` / `ViroErrorState`
- Deep link `/join?code=`
- Portail web : pages `/signup` et `/home` (dashboard admin mock)
- Coquille auth portal (`AuthShell`, `LoginForm`, `SignupForm`)
- Widgets dashboard portal mock (KPI, graphiques, attention, événements)
- Fond décoratif global `DecorShapes` + images landing portal

### Modifié

- Specs produit déplacées vers `docs/specs/` (renommage `viroheam_*` → `viroteam_*`)
- README et chemins de référence alignés sur la nouvelle arborescence docs
- Retrait tournois / championnats de l’UI et des objectifs club
- Cotisations admin : validation hors-ligne + justificatifs d’aides
- `PaymentService` → `HelloAssoPaymentService`
- Rules Firestore (`payment_sessions`, cotisations)
- Landing marketing portal (sections photo, Final CTA)
- Thème portal : fond blanc + formes partagées, typo Inter (alignée app)
- Login portal refactoré vers la coquille auth
- Roadmap : séquence « app prête » puis partenariat HelloAsso (paiements live)

### Corrigé

- Nettoyage `project_config` (retrait `legacyLibPath` monorepo)
- `.gitignore` : ignore `android/.gradle/` et artefacts FVM
- Icône profil home (boucle `/` → `/profile`)

## [1.0.0] - 2026-07-29

### Ajouté

- Auth et onboarding (connexion, inscription, entrée invitation)
- Clubs : sélecteur, détail, setup wizard, multi-club
- Équipes : gestion, membres, double casquette coach/joueur
- Invitations et demandes d’adhésion (modèle invitation uniquement)
- Planning club et joueur (événements, RSVP)
- Annonces club (création, liste, bannière home)
- Cotisations (saisons, paliers, suivi membres, rappels)
- Design system Viro (`ViroScaffold`, `ViroAppBar`, `ViroCard`, `ViroRoleBadge`, Phosphor)
- Config Firestore `v2-dev` / `v2-prod` via `appFirestore`
- Documentation setup local et conventions projet

### Corrigé

- Affichage des tuiles et dates du planning
- Affichage de la page club
