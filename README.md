# ViroTeam

Application Flutter de gestion d’équipe sportive (refonte v2, **invitation uniquement**).

## Stack

- **Flutter / Dart** (SDK ^3.11)
- **État** : Riverpod
- **Navigation** : go_router
- **Backend** : Firebase Auth, Firestore, Storage, Crashlytics
- **UI** : design system Viro (Phosphor, Google Fonts)

## Prérequis

- [Flutter](https://docs.flutter.dev/get-started/install) — **via FVM** (voir ci-dessous), pas besoin d’upgrader le Flutter global
- Fichiers locaux non versionnés (signatures Android, etc.) : voir [`SETUP_LOCAL.md`](SETUP_LOCAL.md)
- Firebase CLI (optionnel, pour déployer rules / indexes)

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
Après ouverture du projet : **Dart: Restart Analysis Server** si l’analyseur affiche encore des erreurs de packages.

## Démarrage

```bash
fvm flutter pub get
fvm flutter run
```

Équivalent sans préfixe si tu as activé le SDK FVM dans l’IDE.
## Structure du projet

```
lib/
  config/       # Thème, motion, routes, project_config
  features/     # Domaines (auth, clubs, planning, fees…)
    <feature>/
      screens/
      widgets/
      providers/
  widgets/
    common/     # ViroScaffold, ViroCard, boutons…
    lists/      # Tuiles de liste réutilisables
  models/
  services/
  utils/
```

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

## Conventions

Document de référence : [`PROJECT_CONVENTIONS.md`](PROJECT_CONVENTIONS.md).  
Constantes machine : `lib/config/project_config.dart`.  
Règles agents Cursor : [`.cursor/rules/`](.cursor/rules/).

## Specs produit

Documents dans [`docs/specs/`](docs/specs/) :

| Document | Sujet |
|----------|--------|
| [`viroteam_v2_design_system_final.md`](docs/specs/viroteam_v2_design_system_final.md) | Design system |
| [`viroteam_v2_ux_journey_detailed.md`](docs/specs/viroteam_v2_ux_journey_detailed.md) | Parcours UX |
| [`viroteam_v2_invitation_only_model.md`](docs/specs/viroteam_v2_invitation_only_model.md) | Modèle invitation uniquement |
| [`viroteam_v2_development_roadmap.md`](docs/specs/viroteam_v2_development_roadmap.md) | Roadmap |
| [`viroteam_v2_club_selector_enhanced.md`](docs/specs/viroteam_v2_club_selector_enhanced.md) | Sélecteur de club |
| [`viroteam_v2_firestore_model.md`](docs/specs/viroteam_v2_firestore_model.md) | Modèle Firestore |
| [`viroteam_v2_fees_spec.md`](docs/specs/viroteam_v2_fees_spec.md) | Cotisations |
| [`viroteam_v2_home_club_pages.md`](docs/specs/viroteam_v2_home_club_pages.md) | Home / pages club |

## Changelog

Historique des versions : [`CHANGELOG.md`](CHANGELOG.md).
