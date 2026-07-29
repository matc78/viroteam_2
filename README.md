# ViroTeam

Application Flutter de gestion d’équipe sportive (refonte, invitation uniquement).

## Lancer

```bash
flutter pub get
flutter run
```

Fichiers locaux (signatures, etc.) : voir [`SETUP_LOCAL.md`](SETUP_LOCAL.md).

## Conventions

**Lire en priorité** : [`PROJECT_CONVENTIONS.md`](PROJECT_CONVENTIONS.md).  
Constantes : `lib/config/project_config.dart`.

## Backend

- Projet Firebase : `viroteam-75303`
- Firestore : `v2-dev` (debug) / `v2-prod` (release) — jamais la base `default`
- Rules / indexes : `firestore.rules`, `firestore.indexes.json`
- Déploiement : `firebase deploy --only firestore`

## Specs produit

- `viroheam_v2_design_system_final.md`
- `viroheam_v2_ux_journey_detailed.md`
- `viroheam_v2_invitation_only_model.md`
- `viroheam_v2_development_roadmap.md`
- `viroteam_v2_firestore_model.md`
- `viroteam_v2_fees_spec.md`
- `viroteam_v2_home_club_pages.md`
