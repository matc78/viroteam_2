# ViroTeam v2 — Conventions projet

Document de référence pour les humains et les agents IA.  
Constantes machine : `lib/config/project_config.dart`.  
Changelog : [`CHANGELOG.md`](CHANGELOG.md).  
Specs produit : [`docs/specs/`](docs/specs/).  
Règles Cursor : [`.cursor/rules/`](.cursor/rules/) (`coding-standards`, `reuse-and-ui`, `git-commits`).

---

## 1. Réutilisation maximale

**Avant d’écrire du code neuf**, chercher dans :

| Source | Chemin |
|--------|--------|
| Widgets communs | `lib/widgets/common/` |
| Tuiles / listes | `lib/widgets/lists/` |
| Thème & motion | `lib/config/viro_*.dart` |
| Services / models | `lib/services/`, `lib/models/` |

**Règles :**

- Réutiliser ou **adapter** un composant existant avant d’en créer un nouveau.
- Un widget validé remplace toute copie inline dans une page.
- Pas de duplication de logique métier : elle vit dans `lib/services/`.
- Si un morceau est partagé par 2+ features → envisager `packages/viro_core` plus tard.

---

## 2. Thème & harmonisation visuelle

Référence technique : `lib/config/viro_theme.dart`, `viro_colors.dart`, `viro_motion.dart`, `viro_icons.dart`.

### Structure d’écran (obligatoire)

- **Toujours** `ViroScaffold` + `ViroAppBar` — **jamais** `Scaffold` / `AppBar` Material bruts sur un écran métier.
- Fond : dégradé `ViroColors.scaffoldGradient` + halos discrets (déjà dans `ViroScaffold`).
- **Interdit** : bandeau / AppBar / header en **bleu opaque plein** (`primary800` en fond d’écran ou d’AppBar).

```dart
// ✅ Bon
ViroScaffold(
  appBar: const ViroAppBar(title: Text('Planning')),
  body: …,
)

// ❌ Mauvais
Scaffold(
  appBar: AppBar(backgroundColor: ViroColors.primary800), // trop lourd, pas harmonieux
  …
)
```

### Répartition des couleurs

| Usage | Comment |
|--------|---------|
| Fond d’écran | Dégradé clair (`scaffoldGradient`) via `ViroScaffold` |
| AppBar | Dégradé clair `headerGradient`, texte/icônes `primary800` |
| Cartes / listes | `ViroCard`, fond `surfaceCard`, bordure `primary100` légère |
| Bleu fort (`primary600`+) | Boutons primaires, liens, accents, badges — **pas** en plein écran |
| Badges rôles | `ViroRoleBadge` (dégradés vifs, texte blanc) |

### Composants UI à réutiliser

| Besoin | Widget |
|--------|--------|
| Page complète | `ViroScaffold` |
| En-tête | `ViroAppBar` |
| Carte / bloc | `ViroCard`, `ViroStatsCard` |
| Badge rôle | `ViroRoleBadge` |
| Icône | `ViroIcon` + `ViroIcons.*` |
| Bouton icône / FAB | `ViroFloatingIconButton`, `ViroFloatingActionButton` |
| Tap avec animation | `ViroPressable` |
| Bouton pleine largeur | `ElevatedButton` / `OutlinedButton` (thème) |

### Motion & ombres

- Durées et courbes → **`ViroMotion`** uniquement.
- Ombres cartes → `ViroMotion.cardShadow()` (douce, teintée bleu — pas d’ombre noire dure).
- Boutons icône, menus, FAB → **`ViroPressable`** ou widgets flottants dédiés.
- Menus / sheets / dialogs → thème Material (`ViroMotion.elevationMenu`).
- Transitions d’écran : fade / Cupertino, pas de slides lourds.

### Icônes

- [Phosphor](https://phosphoricons.com) via `ViroIcons` + `ViroIcon`.
- Pas de `Icons.*` Material dans les écrans.
- Nouvelle icône → l’ajouter dans `ViroIcons` (+ `ViroIcons.catalog` si pertinent).

---

## 3. Structure des fichiers

```
lib/
  app/              # MaterialApp, router
  config/           # Thème, motion, project_config, routes
  features/         # Par domaine (auth, events, tournaments…)
    <feature>/
      screens/      # Écrans fins (composition uniquement)
      widgets/      # Widgets propres à la feature
  widgets/
    common/         # ViroScaffold, ViroCard, ViroRoleBadge, boutons flottants…
    lists/          # OBLIGATOIRE : tuiles et items de liste réutilisables
  models/
  services/
  utils/
```

### Listes et tuiles (obligatoire)

- **Interdit** : `ListView.builder` avec un gros `itemBuilder` inline dans un `*_screen.dart`.
- **Obligatoire** : un fichier dédié par type de ligne, ex. :
  - `lib/widgets/lists/event_list_tile.dart`
  - `lib/widgets/lists/roster_list_tile.dart`
  - `lib/widgets/lists/invite_list_tile.dart`
- L’écran ne fait que : `ListView(children: …)` ou `ListView.builder(itemBuilder: (_, i) => EventListTile(…))`.

---

## 4. Firestore

| Environnement | Base (`databaseId`) |
|---------------|---------------------|
| Debug / dev   | `v2-dev`            |
| Release prod  | `v2-prod`           |

- Toujours passer par **`appFirestore`** (`lib/utils/firestore_instance.dart`).
- **Ne jamais** utiliser `FirebaseFirestore.instance` (base default).
- Bases créées dans le projet Firebase `viroteam-75303`.
- Rules / indexes versionnés : `firestore.rules`, `firestore.indexes.json`.

### Règles de sécurité : garder simple

- Peu de règles complexes côté Firestore ; préférer :
  - `request.auth != null`
  - appartenance club via un champ / sous-doc vérifiable
- Logique sensible (acceptation invitation, fusion de rôles, **lien parent** `linkGuardian`) → **Cloud Functions** callable.
- Parent ≠ rôle club : relation `members/{memberId}/guardians/{parentUid}` + index `users.parentLinks`. Spec : [`docs/specs/viroteam_v2_parents_spec.md`](docs/specs/viroteam_v2_parents_spec.md). Écriture des deux faces via Function, jamais un seul côté client.
- Éviter les `get()` multiples et conditions imbriquées dans les rules.

---

## 5. Unification & cohérence

- **Couleurs / typo / espacements** : uniquement via `lib/config/` (pas de `Color(0xFF…)` dans les features).
- **Thème** : respecter la section 2 (`ViroScaffold`, pas de fond bleu opaque).
- **Textes UI** : français, dans les widgets (pas de i18n pour l’instant).
- **Navigation** : `go_router` (pas de `Navigator.push` dispersé).
- **État** : Riverpod (providers par feature, session globale en tête d’arbre).
- **Nommage** : `FeatureNomScreen`, `FeatureNomListTile`, `feature_nom_service.dart`.

---

## 6. Qualité

- `flutter analyze` sans erreur avant merge.
- Test widget minimal pour chaque `*ListTile` dans `test/widgets/lists/`.
- Pas de requête N+1 : préférer requêtes groupées ou données dénormalisées.
- États vides / erreur / chargement : widgets communs (`EmptyState`, `ErrorState`) — à créer une fois, réutiliser partout.

---

## 7. Suggestions complémentaires (recommandées)

1. **`packages/viro_core`** — extraire models + services partagés quand la duplication devient gênante.
2. **Feature flags** — `kDebugMode` ou Remote Config pour activer des écrans en cours.
3. **Journal des décisions** — section en bas de ce fichier ou `DECISIONS.md` (1 ligne par choix d’archi).
4. **Deep links invitation** — `/join?code=` (cf. `docs/specs/viroteam_v2_invitation_only_model.md`).
5. **Pas de logique dans `build()`** — calculs / streams dans des providers.
6. **Optimistic UI** pour RSVP et actions rapides (Firestore en arrière-plan).
7. **CI** — `flutter test && flutter analyze` sur le repo.
8. **Cursor** — règles dans `.cursor/rules/` (pointent vers ce fichier pour l’UI).

---

## Journal des décisions

| Date | Décision |
|------|----------|
| 2026-05 | Base Firestore dev nommée `V2-dev`, prod `V2-prod` |
| 2026-05 | UI flottante + `ViroMotion` / `ViroPressable` pour interactions |
| 2026-05 | Tuiles de liste obligatoirement dans `lib/widgets/lists/` |
| 2026-05 | Phosphor via `ViroIcons` / `ViroIcon` |
| 2026-05 | Harmonie visuelle : `ViroScaffold` + fond dégradé, AppBar claire, bleu fort réservé aux accents |
| 2026-05 | `ViroRoleBadge` pour les rôles (badges colorés, pas d’emojis) |
| 2026-07 | Repo standalone ; règles Cursor scindées + `CHANGELOG.md` |
| 2026-07 | Specs produit dans `docs/specs/` ; typos `viroheam` corrigées |
| 2026-08 | Parents = relation (pas rôle) ; spec `viroteam_v2_parents_spec.md` ; V1 = 1 adulte / enfant |
