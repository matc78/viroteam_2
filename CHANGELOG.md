# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Versioning Sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- FVM : Flutter 3.44.8 épinglé pour ce repo (SDK global boulot inchangé)
- Roadmap produit : [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Écran profil + déconnexion
- Sync calendrier (aide manuelle + ajout natif + export `.ics`)
- Abstraction `PaymentService` (Noop) + CTA cotisation membre
- Scaffold Cloud Functions (`acceptInvitation`, `paymentWebhook`)
- CI GitHub Actions (`analyze` + `test`)
- `ViroEmptyState` / `ViroErrorState`
- Deep link `/join?code=`

### Modifié

- Specs produit déplacées vers `docs/specs/` (renommage `viroheam_*` → `viroteam_*`)
- README et chemins de référence alignés sur la nouvelle arborescence docs
- Retrait tournois / championnats de l’UI et des objectifs club
- Cotisations admin simplifiées (paiement hors app en secondaire)
- Rules Firestore resserrées (RSVP, invitations, users list)

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
