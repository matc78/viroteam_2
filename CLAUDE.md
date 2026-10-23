# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ViroTeam v2 : gestion d'équipe sportive en **invitation uniquement**. Monorepo : app Flutter (racine), portail web Next.js (`portal/`), Cloud Functions TypeScript (`functions/`), tests des règles Firestore (`rules-tests/`). Tout le projet (code, commentaires, docs, commits) est en **français**.

Références à lire avant un changement important : `PROJECT_CONVENTIONS.md` (conventions UI/archi + journal des décisions), `lib/config/project_config.dart` (constantes machine, modèle de rôles), `.cursor/rules/*.mdc`, specs produit dans `docs/specs/`.

## Commandes

Flutter est épinglé via **FVM** (`.fvmrc` → 3.44.8). Préfixer par `fvm` : `fvm flutter …`, `fvm dart …`.

```bash
# App Flutter (racine)
fvm flutter pub get
fvm flutter run
fvm flutter analyze --no-fatal-infos        # gate CI
fvm flutter test                            # tous les tests
fvm flutter test test/utils/email_validation_test.dart          # un fichier
fvm flutter test --plain-name "nom du test" test/chemin_test.dart  # un test
node tool/check_app_version.mjs [--tag=v2.2.6]   # pubspec ↔ ProjectConfig (↔ tag)

# Option : forcer le backend prod en debug (captures store)
fvm flutter run --dart-define=FORCE_PROD_BACKEND=true

# Portail (portal/)
npm run dev | npm run lint | npm test (vitest) | npm run build

# Cloud Functions (functions/) — test = build tsc + node --test sur lib/**/*.test.js
npm run build | npm test

# Règles Firestore (rules-tests/) — émulateur, nécessite firebase-tools + JDK 21+
npm test
```

Pas de pièges connus à contourner : si quelque chose exige un contournement ou se comporte de façon surprenante, c'est un défaut à signaler (ou corriger), pas une particularité à documenter.

`test/sources_encoding_test.dart` échoue si un fichier `lib/**/*.dart` contient `U+FFFD` : attention à l'encodage UTF-8 lors des éditions de texte FR (notamment via PowerShell).

## Architecture

### Dev vs prod : deux bases Firestore, deux jeux de callables

C'est le point le plus structurant du repo :

- Une seule app Firebase (`viroteam-75303`) mais deux bases Firestore nommées : `v2-dev` (debug/profile) et `v2-prod` (release, ou `FORCE_PROD_BACKEND`). Choix dans `ProjectConfig.firestoreDatabaseId`.
- Côté Flutter, **toujours** `appFirestore` (`lib/utils/firestore_instance.dart`), **jamais** `FirebaseFirestore.instance` (base default).
- Chaque Cloud Function existe en double : `name` (prod) et `nameDev` (dev), générées par `defineDualCallable` / `defineDualRequest` dans `functions/src/db.ts`, qui exécutent le handler dans un contexte `AsyncLocalStorage` fixant la base. Dans le code Functions, utiliser `db` de `db.ts` ; toute nouvelle fonction doit être déclarée via ces helpers et exportée **dans les deux variantes** depuis `functions/src/index.ts`.
- Côté Flutter, appeler une callable via `cloudCallableName('name')` (`lib/utils/cloud_callable.dart`), qui ajoute le suffixe `Dev` hors prod.
- `firestore.rules` / `firestore.indexes.json` sont déployés sur les deux bases (`firebase.json`). Le portail choisit sa base via `NEXT_PUBLIC_FIRESTORE_DATABASE_ID`.

### Logique sensible côté serveur

Les règles Firestore restent simples ; tout ce qui touche à plusieurs documents ou aux droits (acceptation d'invitation, rôles, liens parent, RSVP pour un enfant, paiements, suppression de compte) passe par une callable. Paiement : Stripe Connect est le chemin actif (`functions/src/stripe*.ts`, `FeatureFlags.stripePaymentsLive`). Le code HelloAsso (`createHelloAssoCheckout`, `helloAssoWebhook` dans `functions/src/index.ts`) est **dormant mais conservé volontairement** : un passage futur à HelloAsso (plus avantageux pour les assos sportives) est envisagé — ne pas le supprimer. E-mails via Brevo.

### Modèle de rôles

- Rôle club ∈ `player` ⊂ `coach` ⊂ `admin` (héritage cumulatif). `sessionProvider` (`lib/providers/session_provider.dart`) porte le club actif + rôle membre.
- **Parent n'est pas un rôle** : relation `clubs/{clubId}/members/{memberId}/guardians/{parentUid}` + index `users/{uid}.parentLinks[]`. Les deux faces s'écrivent uniquement via Functions (`functions/src/guardians.ts`). La cible des actions (moi vs enfant) vit dans `clubAudienceSelectionProvider`. Spec : `docs/specs/viroteam_v2_parents_spec.md`.
- Noms de collections/sous-collections : constantes dans `ProjectConfig`, champs dans `lib/constants/firestore_fields.dart`.

### App Flutter

- Entrée : `lib/main.dart` → `ProviderScope` → `lib/app/viro_app.dart`. Router go_router unique dans `lib/config/routes.dart` (redirections auth/session, deep links `/join?code=` via `deep_links.dart` + `pending_invitation_provider`).
- Riverpod : services instanciés comme `Provider` dans `lib/providers/service_providers.dart` ; providers d'état par feature dans `lib/features/<feature>/providers/`.
- Logique métier / accès Firestore dans `lib/services/` (pas dans les écrans, pas dans `build()`). Écrans fins dans `lib/features/<feature>/screens/`.
- Analytics : PostHog uniquement, via `AnalyticsService` (`lib/services/analytics_service.dart`) / `@/lib/posthog` côté portail. Rien sans consentement (`analyticsConsentProvider` dans l'app, bandeau cookies sur le portail), jamais de PII ; identité = uid Firebase + groupe `club`, propriétés construites par `analytics_identity.dart` ↔ `portal/src/lib/analytics/analyticsIdentity.ts` (mêmes clés). Clé prod en release seulement (`ProjectConfig.posthogApiKey`). Événements clés envoyés par les Functions (`captureClubEvent`, groupe `club` seul, jamais d'uid) ; plan de taggage `docs/analytics_events.csv`, dashboards et rituel `docs/ANALYTICS.md`.
- Feature flags dans `lib/config/feature_flags.dart` (ex. messagerie `chatMessagingLive` = debug uniquement, aligné avec `CHAT_MESSAGING_LIVE` côté portail).

### Portail (`portal/`)

Next.js App Router, groupes de routes `(auth)`, `(dashboard)` (bureau admin), `(family)` (espace parent, garde distincte), `(club-setup)`. Logique partagée sous `src/lib/<domaine>`, copy sous `src/lib/copy`. Déployé sur Firebase App Hosting.

## Conventions

Résumé de `PROJECT_CONVENTIONS.md`, qui reste la référence (exemples, journal des décisions) et sert aussi aux règles Cursor. Toute convention ajoutée ou modifiée doit être reportée dans les deux fichiers.

### Réutiliser avant de créer

Chercher d'abord dans `lib/widgets/common/`, `lib/widgets/lists/`, `lib/config/viro_*.dart`, `lib/services/`, `lib/models/`. Adapter un composant existant plutôt qu'en créer un ; un widget validé remplace toute copie inline. La logique métier vit dans `lib/services/`, jamais dupliquée dans les écrans.

| Besoin | Utiliser |
|--------|----------|
| Écran | `ViroScaffold` + `ViroAppBar` (`viro_scaffold.dart`) — jamais `Scaffold`/`AppBar` bruts |
| Carte / bloc | `ViroCard`, `ViroStatsCard` |
| Badge de rôle | `ViroRoleBadge` (dégradés vifs, pas d'emojis) |
| Icône | `ViroIcon` + `ViroIcons.*` (Phosphor) — jamais `Icons.*` ; nouvelle icône → l'ajouter à `ViroIcons` (+ `catalog` si pertinent) |
| Tap animé / bouton icône / FAB | `ViroPressable`, `ViroFloatingIconButton`, `ViroFloatingActionButton` |
| Bouton pleine largeur | `ElevatedButton` / `OutlinedButton` (thème) |
| États vide / erreur | `ViroEmptyState`, `ViroErrorState` (`viro_empty_error_state.dart`) |
| Ligne de liste | une tuile `lib/widgets/lists/<nom>_list_tile.dart` |

### Thème

- Couleurs, typo, espacements, durées/courbes : uniquement via `lib/config/` (`ViroColors`, `ViroSpacing`, `ViroMotion`…) — pas de `Color(0x…)` ni de magic numbers dans les features.
- Dark mode : `ViroTheme.light` / `ViroTheme.dark` embarquent une `ViroPalette` (`lib/config/viro_palette.dart`). Couleurs neutres et de marque via `context.viroPalette` (`textPrimary`, `textSecondary`, `surfaceCard`, `accent`, `brandText`…), **jamais** `ViroColors.gray*` / `primary*` / `surface*` dans `lib/features`, `lib/widgets`, `lib/screens` (garde-fou `test/theme_palette_usage_test.dart`). Restent des constantes : `sport*`, `success`/`warning`/`error`, badges de rôle, blanc sur fond vif. Couleur club en texte/icône → `palette.readableAccent(color)`. Choix Système / Clair / Sombre : `themeModeProvider`, persisté par `ThemePreferenceService`.
- Fond d'écran `palette.background` (blanc en clair, bleu nuit en sombre) + formes décoratives colorées (fournis par `ViroScaffold`). **Interdit** : AppBar / bandeau / fond plein en bleu opaque (`primary800`). Le bleu fort (`accent` / `accentFill`) est réservé aux boutons primaires, liens, accents et badges.
- Ombres de carte : `ViroMotion.cardShadow(palette)` (douce, teintée bleu en clair). Menus / sheets / dialogs : thème Material (`ViroMotion.elevationMenu`). Transitions d'écran : fade / Cupertino, pas de slides lourds.

### Structure

- Écrans (`features/<feature>/screens/`) = composition uniquement. Pas de calcul ni de stream dans `build()` : ça va dans un provider.
- Listes : l'écran fait seulement `ListView.builder(itemBuilder: (_, i) => XxxListTile(…))` ; **interdit** d'écrire un gros `itemBuilder` inline dans un `*_screen.dart`. Chaque tuile a un test widget minimal dans `test/widgets/lists/`.
- Nommage : `FeatureNomScreen`, `FeatureNomListTile`, `feature_nom_service.dart` ; noms explicites (pas de `data`, `res`, `tmp`, `x`).
- `///` en tête de chaque méthode/fonction publique (rôle, params notables, retour) ; pas de commentaire qui répète le code.
- Navigation via go_router uniquement (pas de `Navigator.push`). Écran atteignable par deep link (notif, lien) → `fallbackRoute` sur `ViroScaffold` et `ViroAppBar` (la pile peut être vide), jamais de `context.pop()` nu.
- Pas de requêtes N+1 : préférer les requêtes groupées ou la dénormalisation. Optimistic UI pour le RSVP et les actions rapides.
- Changements ciblés : ce qui est demandé, dans le style de la feature touchée, sans refactor hors scope.

### Textes et voix

- Tout texte UI passe par `AppCopy` (`lib/copy/app_copy_<feature>.dart`), jamais de littéral FR dans un widget.
- Voix « pote de vestiaire » (app uniquement ; le portail peut être plus institutionnel) : tutoiement partout, décontracté, au plus une touche sport par phrase. Humour OK dans les états vides, les succès, l'onboarding ; **pas d'humour** sur le paiement, la suppression de compte, les erreurs critiques ou les confirmations destructives. Garder les termes métier `Coach`, `Match`, `Cotisation`, `Convocation`.

### Accessibilité (pragmatique)

- Élément interactif sans texte (icône seule) → libellé accessible (`tooltip`, `ViroPressable.label`) ; `ViroFloatingIconButton` exige un `tooltip`.
- `ViroIcon` décorative (avec texte à côté) → pas de `semanticLabel` ; icône informative seule → `semanticLabel` obligatoire.
- Tuiles/cartes tappables → `semanticLabel` sans double lecture. Cibles tactiles ≥ `ViroSpacing.minTouchTarget` (44).
- Portail : dialogs via `useDialogA11y` (focus + Escape) ; formulaires sur le modèle de Login (`label`, `aria-invalid`, `role="alert"`). Smoke test manuel : `docs/A11Y_SMOKE.md`.

### Règles Firestore

Garder les règles simples (`request.auth != null`, appartenance au club via un champ ou sous-doc vérifiable) ; éviter les `get()` multiples et les conditions imbriquées. Tout ce qui est sensible passe par une callable (voir Architecture). Les scénarios de règles (failles corrigées + parcours nominaux) sont rejoués dans `rules-tests/`.

## Commits, versions, releases

- Message : `:<gitmoji>: <description explicite en français>` (ex. `:sparkles: ajoute les codes d'invitation d'équipe multi-usage`). Ne committer que sur demande explicite.
- Changements notables → `CHANGELOG.md` section `[Unreleased]` (Keep a Changelog, en français) ; le portail a son propre `portal/CHANGELOG.md`.
- Bump de version app : aligner `pubspec.yaml` (`X.Y.Z+N`) **et** `ProjectConfig.appVersionName`/`appVersionCode`, déplacer `[Unreleased]` dans le CHANGELOG, commit `:bookmark: version app X.Y.Z — changelog, pubspec et ProjectConfig`. La CI refuse un tag dont la version ≠ pubspec.
- Les déploiements se font par tags depuis `main` vert : `v*` / `release-v*` (Android Play Store **et** iOS TestFlight), `portal-v*`, `functions-dev-v*` / `functions-v*`, `firestore-dev-v*` / `firestore-v*` (voir tableau du README).
