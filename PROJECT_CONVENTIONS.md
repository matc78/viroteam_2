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

Référence technique : `lib/config/viro_theme.dart`, `viro_palette.dart`, `viro_colors.dart`, `viro_motion.dart`, `viro_icons.dart`.

### Clair / sombre (obligatoire)

- L’app a deux thèmes : `ViroTheme.light` et `ViroTheme.dark`, chacun avec sa `ViroPalette` (`ThemeExtension`). L’utilisateur choisit Système / Clair / Sombre dans Paramètres > Apparence (`themeModeProvider`, persisté sur l’appareil).
- Couleurs neutres et de marque → **`context.viroPalette`** : `background`, `surfaceCard`, `surfaceSubtle`, `textPrimary`, `textSecondary`, `textMuted`, `border`, `brandText`, `accent`, `accentFill` (fond de bouton plein), `accentSoft`…
- **Interdit** dans `lib/features`, `lib/widgets`, `lib/screens` : `ViroColors.gray*`, `primary*`, `surface*`, `scaffold*` (resteraient clairs en sombre). Garde-fou : `test/theme_palette_usage_test.dart`.
- Restent des constantes `ViroColors` (identiques dans les deux modes) : `sport*`, `success` / `warning` / `error` (texte : `palette.errorText`…), dégradés des badges de rôle, `white` posé sur un fond vif.
- Couleur de marque club en texte ou icône → `palette.readableAccent(color)` (éclaircie si trop foncée en sombre).

```dart
// ✅ Bon
final palette = context.viroPalette;
Text(label, style: textTheme.bodySmall?.copyWith(color: palette.textSecondary));

// ❌ Mauvais — reste gris foncé sur fond sombre
Text(label, style: textTheme.bodySmall?.copyWith(color: ViroColors.gray600));
```

### Structure d’écran (obligatoire)

- **Toujours** `ViroScaffold` + `ViroAppBar` — **jamais** `Scaffold` / `AppBar` Material bruts sur un écran métier.
- Fond : `palette.background` (blanc en clair, bleu nuit en sombre) + formes décoratives colorées (cercles bleu clair / sport, déjà dans `ViroScaffold`, accord portail web).
- **Interdit** : bandeau / AppBar / header en **bleu opaque plein** (`primary800` en fond d’écran ou d’AppBar).

```dart
// ✅ Bon
ViroScaffold(
  appBar: ViroAppBar(title: Text(AppCopy.planning.screenTitle)),
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
| Fond d’écran | `palette.background` + formes décoratives via `ViroScaffold` |
| AppBar | `ViroAppBar` transparente (laisse voir le fond), titre `palette.brandText`, icônes `palette.accent` (thème) |
| Cartes / listes | `ViroCard`, fond `palette.surfaceCard`, bordure `palette.cardBorder` légère |
| Bleu fort (`palette.accent` / `accentFill`) | Boutons primaires, liens, accents, badges — **pas** en plein écran |
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
- Ombres cartes → `ViroMotion.cardShadow(palette)` (douce, teintée bleu en clair — pas d’ombre noire dure ; plus dense et neutre en sombre).
- Boutons icône, menus, FAB → **`ViroPressable`** ou widgets flottants dédiés.
- Menus / sheets / dialogs → thème Material (`ViroMotion.elevationMenu`).
- Transitions d’écran : fade / Cupertino, pas de slides lourds.

### Icônes

- [Phosphor](https://phosphoricons.com) via `ViroIcons` + `ViroIcon`.
- Pas de `Icons.*` Material dans les écrans.
- Nouvelle icône → l’ajouter dans `ViroIcons` (+ `ViroIcons.catalog` si pertinent).
- `ViroIcon` décorative (texte voisin) → pas de `semanticLabel` ; informative seule → `semanticLabel` obligatoire.

### Accessibilité (pragmatique)

- Interactif **icon-only** → libellé accessible (`tooltip` / `ViroPressable.label` / `aria-label` côté portail).
- `ViroFloatingIconButton` exige toujours un `tooltip` (Tooltip + Semantics).
- Tuiles / cartes tappables → `semanticLabel` (ou texte enfant clairement annoncé), pas de double lecture.
- Cibles tactiles ≥ `ViroSpacing.minTouchTarget` (44).
- Portail : dialogs via `useDialogA11y` (focus + Escape) ; formulaires sur le modèle Login (`label`, `aria-invalid`, `role="alert"`).
- Smoke manuel : [`docs/A11Y_SMOKE.md`](docs/A11Y_SMOKE.md).

---

## 3. Structure des fichiers

```
lib/
  app/              # MaterialApp, router
  config/           # Thème, motion, project_config, routes
  copy/             # AppCopy — tous les textes UI (FR)
  constants/        # Champs Firestore (firestore_fields.dart), textes légaux
  features/         # Par domaine (auth, planning, fees, members, chat…)
    <feature>/
      screens/      # Écrans fins (composition uniquement)
      widgets/      # Widgets propres à la feature
      providers/    # État Riverpod de la feature
      (models/ services/ utils/ si propres à la feature)
  providers/        # Session globale + providers des services
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
  - `lib/widgets/lists/member_list_tile.dart`
  - `lib/widgets/lists/member_fee_list_tile.dart`
  - `lib/widgets/lists/club_activity_list_tile.dart`
- L’écran ne fait que : `ListView(children: …)` ou `ListView.builder(itemBuilder: (_, i) => MemberListTile(…))`.

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
- **Textes UI** : via **`AppCopy`** (`lib/copy/`) — pas de littéraux FR dans les widgets/écrans.
- **Navigation** : `go_router` (pas de `Navigator.push` dispersé).
- **Retour arrière** : tout écran atteignable par deep link (notif, lien) passe `fallbackRoute` (écran parent logique) à `ViroScaffold` **et** `ViroAppBar` — jamais de `context.pop()` nu : la pile peut être vide. Hors widget, `popOrGo` (`lib/config/navigation_fallback.dart`).
- **État** : Riverpod (providers par feature, session globale en tête d’arbre).
- **Nommage** : `FeatureNomScreen`, `FeatureNomListTile`, `feature_nom_service.dart`.

---

## 5bis. Voix produit (app)

Ton **pote de vestiaire** : tutoiement, décontracté, sportif, humour léger dosé.

| Règle | Détail |
|-------|--------|
| Tutoiement | **tu** partout dans l’app (pas de vouvoiement SaaS) |
| Humour OK | Empty states, succès, onboarding, home calme — max une touche sport par phrase |
| Humour non | Suppression de compte, paiement, erreurs critiques, confirmations destructives |
| Glossaire métier | Garder `Coach`, `Match`, `Cotisation`, `Convocation` — on change les phrases, pas les termes |
| Portail | Hors scope (ton plus institutionnel possible) |

```dart
// ✅ Bon
Text(AppCopy.home.quietSubtitle)

// ❌ Mauvais — littéral UI dans le widget
Text('Aucun événement pour le moment')
```

Exemples de cible :

| Avant | Après |
|-------|--------|
| « Votre planning est à jour — rien à venir… » | « Terrain libre — rien au planning pour l’instant. Profite-en pour récupérer. » |
| « Aucun membre pour le moment » | « Effectif encore vide — ajoute ton premier joueur. » |
| « Gérez votre club sportif… » | « Ton club, ton vestiaire digital : planning, convoc’, cotisations. » |

---

## 6. Qualité


- `flutter analyze` sans erreur avant merge.
- Test widget minimal pour chaque `*ListTile` dans `test/widgets/lists/`.
- Pas de requête N+1 : préférer requêtes groupées ou données dénormalisées.
- États vides / erreur : `ViroEmptyState`, `ViroErrorState` (`lib/widgets/common/viro_empty_error_state.dart`) — réutiliser partout.

---

## 7. Pratiques complémentaires

En place :

- **Feature flags** — `lib/config/feature_flags.dart` (`kDebugMode` / constantes), alignés côté portail.
- **Journal des décisions** — section en bas de ce fichier (1 ligne par choix d’archi).
- **Deep links invitation** — `/join?code=` (cf. `docs/specs/viroteam_v2_invitation_only_model.md`).
- **CI** — `.github/workflows/ci.yml` (analyze + test Flutter, portail, functions, rules).
- **Agents IA** — `CLAUDE.md` et `.cursor/rules/` (pointent vers ce fichier).
- **Analytics produit** — PostHog uniquement, via `AnalyticsService` (app) / `@/lib/posthog` (portail) : rien n’est envoyé sans consentement, jamais de PII (nom, e-mail, téléphone, contenus) ; identité = uid Firebase, propriétés personne / groupe `club` construites par `analytics_identity.dart` ↔ `analyticsIdentity.ts` (mêmes clés). Événements nommés `objet_action` en snake_case. Plan de taggage : `docs/analytics_events.csv` (tout nouvel événement y est ajouté). Les événements clés (inscription, club créé, invitations, RSVP, paiement réussi…) partent des Functions via `captureClubEvent` (`functions/src/analytics.ts`) : rattachés au groupe `club` seulement, jamais à un uid (le consentement n’est connu que des clients). Tableaux de bord et rituel : `docs/ANALYTICS.md`.

À appliquer :

- **Pas de logique dans `build()`** — calculs / streams dans des providers.
- **Optimistic UI** pour RSVP et actions rapides (Firestore en arrière-plan).

Plus tard :

- **`packages/viro_core`** — extraire models + services partagés quand la duplication devient gênante.

---

## Journal des décisions

| Date | Décision |
|------|----------|
| 2026-05 | Base Firestore dev nommée `v2-dev`, prod `v2-prod` |
| 2026-05 | UI flottante + `ViroMotion` / `ViroPressable` pour interactions |
| 2026-05 | Tuiles de liste obligatoirement dans `lib/widgets/lists/` |
| 2026-05 | Phosphor via `ViroIcons` / `ViroIcon` |
| 2026-05 | Harmonie visuelle : `ViroScaffold` + fond dégradé, AppBar claire, bleu fort réservé aux accents |
| 2026-05 | `ViroRoleBadge` pour les rôles (badges colorés, pas d’emojis) |
| 2026-07 | Repo standalone ; règles Cursor scindées + `CHANGELOG.md` |
| 2026-07 | Specs produit dans `docs/specs/` ; typos `viroheam` corrigées |
| 2026-08 | Parents = relation (pas rôle) ; spec `viroteam_v2_parents_spec.md` ; V1 = 1 adulte / enfant |
| 2026-09 | Copy UI centralisé dans `AppCopy` (`lib/copy/`) ; voix « pote de vestiaire » (tutoiement) |
| 2026-10 | A11y pragmatique : Semantics sur primitives app + `useDialogA11y` portail ; smoke `docs/A11Y_SMOKE.md` |
| 2026-10 | Paiement CB via Stripe Connect ; HelloAsso dormant mais conservé (réactivation envisagée) |
| 2026-10 | `CLAUDE.md` ajouté pour Claude Code (résumé de ce fichier + architecture dev/prod) |
| 2026-10 | Retour arrière : `fallbackRoute` sur `ViroScaffold` / `ViroAppBar` pour les écrans ouverts par deep link (pile vide) |
| 2026-10 | Notifs : rappels J-2 + jour J (J-7 si « Événement important »), ciblés par réponse ; récap du dimanche ; réponses RSVP au staff (coéquipiers en opt-in) ; copy tutoyée avec équipe / jour / heure |
| 2026-10 | Push au premier plan affichées par l’app (`LocalNotificationService` + `ForegroundPushPolicy`), Android et iOS ; un canal Android par clé de préférence (`PushChannel` ↔ `ANDROID_CHANNEL_IDS`) ; permission demandée via pré-demande, jamais au lancement |
| 2026-10 | Dark mode app : `ViroPalette` (`ThemeExtension`) via `context.viroPalette`, `ViroTheme.dark`, choix Système / Clair / Sombre persisté localement ; `ViroColors` neutres / primaires interdits hors `lib/config` (garde-fou test) ; portail inchangé |
| 2026-10 | Analytics : PostHog seul (Firebase Analytics retiré), projets dev / prod séparés, consentement explicite dans l’app (feuille + Paramètres) et bandeau cookies sur le portail ; identify uid Firebase + groupe `club`, mêmes clés web / mobile |
| 2026-10 | Événements clés envoyés par les Functions, rattachés au club seul (pas d’uid, pas besoin du consentement client) ; plan de taggage `docs/analytics_events.csv` ; liens stores marqués par campagne (`utm_source` = surface, `utm_campaign` = emplacement) ; replay de sessions portail écarté pour l’instant |
