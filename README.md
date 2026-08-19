# ViroTeam

Application Flutter de gestion d'équipe sportive (refonte v2, **invitation uniquement**).  
Portail web admin (Next.js) pour la gestion bureau. Landing marketing incluse.

## Stack

| Couche | Technologies |
|--------|-------------|
| App mobile | **Flutter / Dart** (SDK ^3.11), Riverpod, go_router |
| Portail web | **Next.js** (App Router), TypeScript, CSS Modules |
| Backend | Firebase Auth, Firestore, Storage, Cloud Functions |
| Monitoring | Crashlytics (mobile), Sentry (portail), PostHog (analytics) |
| UI | Design system Viro (Phosphor, Google Fonts / Inter) |
| Hébergement portail | Firebase App Hosting (europe-west4) |

## Prérequis

- [Flutter](https://docs.flutter.dev/get-started/install) — **via FVM** (voir ci-dessous)
- [Node.js](https://nodejs.org/) — pour le portail et les Cloud Functions
- Fichiers locaux non versionnés : voir [`SETUP_LOCAL.md`](SETUP_LOCAL.md)
- Firebase CLI (optionnel, pour déployer rules / indexes / functions)

## Flutter via FVM

Ce projet est épinglé sur **Flutter 3.44.8** (Dart 3.12) via [FVM](https://fvm.app/), pour ne pas toucher au Flutter global (ex. projets boulot).

```bash
# Une fois : installer FVM (et ajouter %LOCALAPPDATA%\Pub\Cache\bin au PATH Windows)
dart pub global activate fvm

# Dans ce repo
fvm install
fvm flutter pub get
fvm flutter run
```

Dans Cursor / VS Code, le SDK est déjà pointé via [`.vscode/settings.json`](.vscode/settings.json) (`.fvm/flutter_sdk`).  
Après ouverture du projet : **Dart: Restart Analysis Server** si l'analyseur affiche encore des erreurs de packages.

## Démarrage

### App mobile

```bash
fvm flutter pub get
fvm flutter run
```

Équivalent sans préfixe si tu as activé le SDK FVM dans l'IDE.

### Portail web

```bash
cd portal
cp .env.local.example .env.local   # prérempli pour viroteam-75303
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000). Détails : [`portal/README.md`](portal/README.md).

### Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

Détails : [`functions/README.md`](functions/README.md).

## CI / Releases

- **Push / PR** : [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — `flutter analyze` + `flutter test` (Flutter 3.44.8). Aucun secret requis.
- **Tag `v*`** : [`.github/workflows/release.yml`](.github/workflows/release.yml) — build APK release **signé**, publié sur **GitHub → Releases**.
- **Tag `portal-v*`** : [`.github/workflows/deploy-portal.yml`](.github/workflows/deploy-portal.yml) — déploiement du portail Next.js sur **Firebase App Hosting** (budget alerte 5 €/mois).

```bash
git tag v1.0.0
git push origin v1.0.0

git tag portal-v0.1.0
git push origin portal-v0.1.0
```

L'APK apparaît sur la page Releases du repo (`viro-team-v2-1.0.0.apk`). Build manuel sans tag : **Actions → Release APK → Run workflow**.

Secrets Android (une fois) : voir [`SETUP_LOCAL.md`](SETUP_LOCAL.md).  
Secret portail (une fois) : `FIREBASE_SERVICE_ACCOUNT_PORTAL` — voir [`portal/README.md`](portal/README.md).

## Structure du projet

```
lib/
  app/            # MaterialApp, router
  config/         # Thème, motion, routes, project_config
  features/       # Domaines (auth, clubs, planning, fees, parents…)
    <feature>/
      screens/
      widgets/
      providers/
  widgets/
    common/       # ViroScaffold, ViroCard, boutons, ViroEmptyState…
    lists/        # Tuiles de liste réutilisables
  models/
  services/
  utils/

portal/           # Portail web Next.js (landing + dashboard admin + espace famille)
functions/        # Cloud Functions (invitations, paiements, parents)
docs/
  specs/          # Specs produit
  ROADMAP.md      # Plan d'évolution priorisé
```

## Fonctionnalités

### App mobile

- Auth et onboarding (connexion, inscription, entrée par code d'invitation)
- Clubs : sélecteur multi-club, détail, setup wizard
- Équipes : gestion, membres, double casquette coach/joueur
- Invitations et demandes d'adhésion (modèle invitation uniquement)
- Planning club et joueur (événements, RSVP)
- Sync calendrier (aide manuelle + ajout natif + export `.ics`)
- Annonces club (création, liste, bannière home)
- Cotisations (saisons, paliers, suivi membres, rappels)
- Paiements hybrides HelloAsso (1×/3×, aides Pass'Sport/ANCV, hors-ligne)
- Espace famille parent (planning, RSVP, cotisation au nom de l'enfant)
- Profil + déconnexion
- Deep link `/join?code=`
- Crashlytics + PostHog analytics

### Portail web

- Landing marketing (sections photo, CTA, liens stores)
- Auth Firebase (email + mot de passe)
- Dashboard admin : home, membres, cotisations, planning
- Planning : calendrier avec sélecteurs custom, picker invités multi, filtres persistants
- Suivi cotisations : paiement hors-ligne, validation aides, HelloAsso
- Espace famille parent (garde et navigation distinctes du bureau admin)
- Fond décoratif global `DecorShapes`, thème Inter aligné sur l'app

### Cloud Functions

- `acceptInvitation` — accepter une invitation
- `inviteGuardian` / `linkGuardian` / `revokeGuardian` — gestion parents (deux faces)
- `setEventRsvp` — RSVP pour soi ou un enfant lié
- `createHelloAssoCheckout` — checkout HelloAsso (1×/3× + aides)
- `helloAssoWebhook` — webhook paiement (crédite uniquement après notif serveur)

## Backend Firebase

| Élément | Valeur |
|---------|--------|
| Projet | `viroteam-75303` |
| Firestore debug | `v2-dev` |
| Firestore release | `v2-prod` |

- Accès client uniquement via `appFirestore` (`lib/utils/firestore_instance.dart`) — **jamais** la base `default`
- Rules : [`firestore.rules`](firestore.rules)
- Indexes : [`firestore.indexes.json`](firestore.indexes.json)

```bash
firebase deploy --only firestore
```

## Dashboards et outils

| Outil | Usage | Lien |
|-------|-------|------|
| Firebase Console | Auth, Firestore, Storage, Functions, Crashlytics, App Hosting | [console.firebase.google.com](https://console.firebase.google.com/project/viroteam-75303) |
| PostHog | Analytics app + portail | [eu.posthog.com](https://eu.posthog.com) |
| Sentry | Monitoring erreurs portail | [sentry.io](https://sentry.io) |
| GitHub Actions | CI (analyze + test), Release APK, Deploy portail | onglet **Actions** du repo |
| Google Cloud Billing | Budget / alertes (5 €/mois) | [console.cloud.google.com/billing](https://console.cloud.google.com/billing) |

## Conventions

Document de référence : [`PROJECT_CONVENTIONS.md`](PROJECT_CONVENTIONS.md).  
Constantes machine : `lib/config/project_config.dart`.  
Règles agents Cursor : [`.cursor/rules/`](.cursor/rules/).

## Roadmap

Plan d'évolution priorisé : [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Specs produit

Documents dans [`docs/specs/`](docs/specs/) :

| Document | Sujet |
|----------|--------|
| [`viroteam_v2_design_system_final.md`](docs/specs/viroteam_v2_design_system_final.md) | Design system |
| [`viroteam_v2_ux_journey_detailed.md`](docs/specs/viroteam_v2_ux_journey_detailed.md) | Parcours UX |
| [`viroteam_v2_invitation_only_model.md`](docs/specs/viroteam_v2_invitation_only_model.md) | Modèle invitation uniquement |
| [`viroteam_v2_development_roadmap.md`](docs/specs/viroteam_v2_development_roadmap.md) | Roadmap historique (verite : [`docs/ROADMAP.md`](docs/ROADMAP.md)) |
| [`viroteam_v2_club_selector_enhanced.md`](docs/specs/viroteam_v2_club_selector_enhanced.md) | Sélecteur de club |
| [`viroteam_v2_firestore_model.md`](docs/specs/viroteam_v2_firestore_model.md) | Modèle Firestore |
| [`viroteam_v2_fees_spec.md`](docs/specs/viroteam_v2_fees_spec.md) | Cotisations |
| [`viroteam_v2_payments_helloasso_spec.md`](docs/specs/viroteam_v2_payments_helloasso_spec.md) | Paiements HelloAsso |
| [`viroteam_v2_web_portal_spec.md`](docs/specs/viroteam_v2_web_portal_spec.md) | Portail web (bureau + allègement mobile) |
| [`viroteam_v2_parents_spec.md`](docs/specs/viroteam_v2_parents_spec.md) | Parents (relation, pas rôle) |
| [`viroteam_v2_home_club_pages.md`](docs/specs/viroteam_v2_home_club_pages.md) | Home / pages club |

## Changelog

Historique des versions : [`CHANGELOG.md`](CHANGELOG.md).
