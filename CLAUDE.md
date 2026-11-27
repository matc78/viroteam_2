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

JDK 21 (Temurin) installé sur le poste de dev mais **pas par défaut** (le `java` du PATH est un JDK 17). Pour `rules-tests`, le pointer dans la session PowerShell avant `npm test` :

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot"; $env:Path = "$env:JAVA_HOME\bin;$env:Path"
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

### Modèle de droits (« droits purs »)

- **Seuls les droits autorisent** : `members/{id}.permissions` (11 droits club, catalogue `shared/permissions_catalog.json` + parité par couche), écrit uniquement par les Functions (`setMemberPermissions`, `createClub`…). Le droit `admin` implique tous les autres et permet seul d'attribuer des droits ; toujours au moins un admin par club. Pas de modèle de rôle : on coche la bascule Administrateur, des « fonctions » (Responsable cotisations… : groupes de droits non stockés) ou des droits à la carte. Plus de champ `role`, ni de demande de rôle. Spec : `docs/specs/viroteam_v2_permissions_spec.md`.
- **Coach d'équipe = relation** (`teams.coachIds`, dérivé en `members/{id}.coachTeamIds` par trigger) : capacités sur ses seules équipes, réglées par `clubs.coachPermissions`. `clubs.adminIds` n'est qu'un index d'audience, jamais une autorisation. Champs d'accès d'une fiche, tous écrits par les Functions : `permissions`, `coachTeamIds`, `teamIds` (trigger d'équipe, depuis `teams.playerIds`/`coachIds`), `accountUid`. Badges dérivés, jamais stockés : Admin > Entraîneur > Joueur > **Membre** (gris, ni admin ni équipe), plus Parent. Vue équipe : Entraîneur / Joueur / **Sparring** (gris argent : `teams.sparringIds` ⊆ `playerIds`, joueur non convoqué par défaut aux matchs, ajoutable match par match ; badge d'affichage seulement, jamais dérivé de la fiche), jamais Admin ; RSVP d'un événement d'équipe : Entraîneur seulement ; RSVP d'un événement spécial (toutes équipes ou aucune) : Admin en plus.
- Point d'entrée unique par couche : `functions/src/permissions.ts` ; `ClubAccess` via `clubAccessProvider` (app, garde de route `ClubAccessGuard`) ; `useBureauCapabilities()` (portail) ; `can()` / `coachCan()` (règles). Aucune comparaison de rôle — garde-fous `permissionUsage.test.ts` (Functions, portail) et `test/permission_usage_test.dart`. Index `adminIds` calculé seulement par `adminIdsUpdate`. Coach sur un événement : modifier / annuler / notifier exige toutes ses équipes et jamais `allTeams`. `sessionProvider` ne porte que le club actif.
- **Parent n'est pas un rôle** : relation `clubs/{clubId}/members/{memberId}/guardians/{parentUid}` + index `users/{uid}.parentLinks[]`. Les deux faces s'écrivent uniquement via Functions (`functions/src/guardians.ts`). La cible des actions (moi vs enfant) vit dans `clubAudienceSelectionProvider`. Spec : `docs/specs/viroteam_v2_parents_spec.md`.
- **Une seule clé membre** : une fiche liée à un compte vit à `members/{uid}` ; son id est la seule clé membre partout (rosters, RSVP, guardians, cotisations, annonces, invitations, `parentLinks`, `adminIds`). Une fiche pré-inscrite (id aléatoire) est re-clée à la liaison par `functions/src/memberRekey.ts` (anciens ids dans `formerMemberIds`). Ma fiche = `members/{monUid}` ; l'uid Auth d'une fiche = son `accountUid` (aucun si non liée, jamais l'id aléatoire) — plus de `userId` ni de `memberId` sur une fiche. Clubs d'un compte : `users/{uid}.memberClubIds` (seul index, écrit par les Functions qui ajoutent ou retirent un membre). Plus d'index `member_accounts` ni de résolveur uid ↔ memberId. Référence d'une fiche : `clubMemberRef` (`lib/services/member/member_paths.dart`), `memberRefs.ts` côté portail. Jamais de fiche de compte à id aléatoire ni de repli `accountUid ?? memberId` — garde-fous `functions/src/memberKeyUsage.test.ts`, `test/member_key_usage_test.dart`, `portal/src/lib/members/memberKeyUsage.test.ts`. Nom / photo du compte → fiche : trigger `onUserWrittenSyncMemberProfile` uniquement (les clients n'écrivent que `users/{uid}`).
- Noms de collections/sous-collections : constantes dans `ProjectConfig`, champs dans `lib/constants/firestore_fields.dart`.

### App Flutter

- Entrée : `lib/main.dart` → `ProviderScope` → `lib/app/viro_app.dart`. Router go_router unique dans `lib/config/routes.dart` (redirections auth/session, deep links `/join?code=` via `deep_links.dart` + `pending_invitation_provider`).
- Riverpod : services instanciés comme `Provider` dans `lib/providers/service_providers.dart` ; providers d'état par feature dans `lib/features/<feature>/providers/`.
- Logique métier / accès Firestore dans `lib/services/` (pas dans les écrans, pas dans `build()`). Écrans fins dans `lib/features/<feature>/screens/`.
- Analytics : PostHog uniquement, via `AnalyticsService` (`lib/services/analytics_service.dart`) / `@/lib/posthog` côté portail. Rien sans consentement (`analyticsConsentProvider` dans l'app, bandeau cookies sur le portail), jamais de PII ; identité = uid Firebase + groupe `club`, propriétés construites par `analytics_identity.dart` ↔ `portal/src/lib/analytics/analyticsIdentity.ts` (mêmes clés). Clé prod en release seulement (`ProjectConfig.posthogApiKey`). Événements clés envoyés par les Functions (`captureClubEvent`, groupe `club` seul, jamais d'uid) ; plan de taggage `docs/analytics_events.csv`, dashboards et rituel `docs/ANALYTICS.md`.
- Feature flags dans `lib/config/feature_flags.dart`. Messagerie : `chatMessagingLiveProvider` (debug toujours ; release si `users/{uid}.flags.chatMessaging`) — portail `isChatMessagingLive` / `NEXT_PUBLIC_CHAT_MESSAGING_LIVE` en local.

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
| Icône | `ViroIcon` + `ViroIcons.*` (Phosphor) — jamais `Icons.*` ; nouvelle icône → l'ajouter à `ViroIcons` (+ `catalog` si pertinent) ; icône dessinée pour ViroTeam (droits, fonctions) → `ViroGlyphIcon` + `ViroGlyph` (SVG deux tons dans `assets/icons/glyphs/`) |
| Sélection (cocher / décocher) | `ViroSelectableRow` (ligne : fond teinté, hauteur constante, re-tap = forme d'origine) / `ViroSelectionMark` (coche ronde seule), dimensions `ViroSelection` — jamais `Checkbox` / `CheckboxListTile` (garde-fou `test/selection_usage_test.dart`) ; `Switch` réservé aux réglages on/off |
| Tap animé / bouton icône / FAB | `ViroPressable`, `ViroFloatingIconButton`, `ViroFloatingActionButton` |
| Bouton pleine largeur | `ElevatedButton` / `OutlinedButton` (thème) |
| États vide / erreur | `ViroEmptyState`, `ViroErrorState` (`viro_empty_error_state.dart`) |
| Ligne de liste | une tuile `lib/widgets/lists/<nom>_list_tile.dart` |
| Avatar de conversation | `ViroConversationAvatar` (tailles `ViroChat.avatar*`) |
| Retour haptique | `ViroHaptics` (`confirm` / `selection` / `threshold` / `success` / `error` ; appui long hors `ViroPressable` → `ViroHaptics.longPress(action)`) — jamais `HapticFeedback` direct (garde-fou `test/haptics_usage_test.dart`) ; pas de vibration sur la navigation, les taps génériques ni les actions destructives |

### Thème

- Couleurs, typo, espacements, durées/courbes : uniquement via `lib/config/` (`ViroColors`, `ViroSpacing`, `ViroMotion`…) — pas de `Color(0x…)` ni de magic numbers dans les features.
- Messagerie : dimensions via `ViroChat` (`lib/config/viro_chat.dart`) ↔ variables `--chat-*` du portail (`globals.css`), mêmes valeurs des deux côtés ; portail sans hexa en dur dans les CSS du chat, briques dans `chatShared.module.css`, textes dans `chatCopy.ts` (clés de `app_copy_chat.dart`). Points de rupture du chat : 767 et 1024 px seulement (`ChatBreakpoints`, testé).
- Dark mode : `ViroTheme.light` / `ViroTheme.dark` embarquent une `ViroPalette` (`lib/config/viro_palette.dart`). Couleurs neutres et de marque via `context.viroPalette` (`textPrimary`, `textSecondary`, `surfaceCard`, `accent`, `brandText`…), **jamais** `ViroColors.gray*` / `primary*` / `surface*` dans `lib/features`, `lib/widgets`, `lib/screens` (garde-fou `test/theme_palette_usage_test.dart`). Restent des constantes : `sport*`, `success`/`warning`/`error`, badges de rôle, blanc sur fond vif. Couleur club en texte/icône → `palette.readableAccent(color)`. Choix Système / Clair / Sombre : `themeModeProvider`, persisté par `ThemePreferenceService`.
- Fond d'écran `palette.background` (blanc en clair, bleu nuit en sombre) + formes décoratives colorées (fournis par `ViroScaffold`). **Interdit** : AppBar / bandeau / fond plein en bleu opaque (`primary800`). Le bleu fort (`accent` / `accentFill`) est réservé aux boutons primaires, liens, accents et badges.
- Ombres de carte : `ViroMotion.cardShadow(palette)` (douce, teintée bleu en clair). Cartes / tuiles à accent → `ViroMotion.accentBorderTileShadow` (halo teinté en dark seulement ; auto via `ViroCard` si `borderColor` ou `accentColor`). Menus / sheets / dialogs : thème Material (`ViroMotion.elevationMenu`). Transitions d'écran : fade / Cupertino, pas de slides lourds.

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

### Portail — espace connecté

- Coquille `PortalShell` (`portal/src/components/shell/`, sidebar + tiroir mobile) pour le bureau et la famille.
- Primitives `portal/src/components/ui/` (`Card`, `PageHeader`, `StatTile`, `StatusBadge`, `EmptyState`, `ListRow`, `ToggleRow`, `SegmentedChoice`, `Button`…) avant tout nouveau composant.
- Tokens sémantiques de `globals.css` uniquement (`--surface-*`, `--text-*`, `--border-*`, `--accent*`, `--status-*`), pas de hex ; couleur réservée aux statuts et à l’action principale (exceptions : la sidebar, un ton `--tone-*` par lien et une couleur par badge ; les catégories d’équipe, une couleur distincte par catégorie via `assignTeamCategoryTones`).
- Page : `PageHeader` → ce qui demande une action → chiffres clés → contenu. Décor (`DecorShapes`) : landing / auth / club-setup seulement.

### Accessibilité (pragmatique)

- Élément interactif sans texte (icône seule) → libellé accessible (`tooltip`, `ViroPressable.label`) ; `ViroFloatingIconButton` exige un `tooltip`.
- `ViroIcon` décorative (avec texte à côté) → pas de `semanticLabel` ; icône informative seule → `semanticLabel` obligatoire.
- Tuiles/cartes tappables → `semanticLabel` sans double lecture. Cibles tactiles ≥ `ViroSpacing.minTouchTarget` (44).
- Portail : dialogs via `useDialogA11y` (focus + Escape ; `modal: false` pour panneaux latéraux et fenêtres non bloquantes) ; menus via `useMenuA11y` ; pas de `window.confirm` ; action au clic droit → aussi un bouton au survol et au focus ; `aria-live` limité au nouveau contenu ; formulaires sur le modèle de Login (`label`, `aria-invalid`, `role="alert"`). Smoke test manuel : `docs/A11Y_SMOKE.md` ; recette messagerie : `docs/CHAT_SMOKE.md`.

### Règles Firestore

Garder les règles simples (`request.auth != null`, appartenance au club via un champ ou sous-doc vérifiable) ; éviter les `get()` multiples et les conditions imbriquées. Tout ce qui est sensible passe par une callable (voir Architecture). Les scénarios de règles (failles corrigées + parcours nominaux) sont rejoués dans `rules-tests/`.

## Commits, versions, releases

- Message : `:<gitmoji>: <description explicite en français>` (ex. `:sparkles: ajoute les codes d'invitation d'équipe multi-usage`). Ne committer que sur demande explicite.
- Changements notables → `CHANGELOG.md` section `[Unreleased]` (Keep a Changelog, en français) ; le portail a son propre `portal/CHANGELOG.md`.
- Bump de version app : aligner `pubspec.yaml` (`X.Y.Z+N`) **et** `ProjectConfig.appVersionName`/`appVersionCode`, déplacer `[Unreleased]` dans le CHANGELOG, écrire les notes des stores `distribution/release-notes/X.Y.Z.txt` (≤ 500 caractères avec l'en-tête « Version X.Y.Z » ajouté par `tool/release_notes.mjs` ; voix de l'app, ce que voit l'utilisateur), commit `:bookmark: version app X.Y.Z — changelog, pubspec et ProjectConfig`. La CI refuse un tag dont la version ≠ pubspec.
- Les déploiements se font par tags depuis `main` vert : `v*` / `release-v*` (Android Play Store **et** iOS TestFlight), `portal-v*`, `functions-v*` (un seul tag : déploie `*Dev` et prod ensemble), `firestore-dev-v*` / `firestore-v*` (voir tableau du README).
