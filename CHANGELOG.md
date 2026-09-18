# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Versioning Sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- Messagerie in-app (Flutter + portail) : threads, DM, sondages, réactions, réponses, panel infos, dock flottant, deep links et notifications
- Backend chat : sync équipes, triggers Cloud Functions et règles Firestore
- Activation roster et import membres sans e-mail obligatoire (portail)
- Specs et roadmap messagerie v2
- SEO landing : sitemap XML (route handler), `robots.txt` élargi, JSON-LD enrichi, mots-clés ciblés, FAQ marketing élargie, redirect `viroteam.com` → `www.viroteam.com`
- Contrôle d’alignement de version `pubspec.yaml` ↔ `ProjectConfig` ↔ tags (`tool/check_app_version.mjs`) branché en CI et Release Android

### Sécurité

- Durcissement des règles chat (réactions et preview inbox)

### Modifié

- Version app alignée sur les tags Play : `pubspec.yaml` / `ProjectConfig` en `2.2.2+6`
- Textes landing (hero, sections, FAQ, CTA) pour refléter planning, membres, cotisations et app club
- Reverse proxy PostHog et DSN Sentry EU
- Badge / logo Play Store aux couleurs officielles
- Ignore le `node_modules` npm installé par erreur à la racine du monorepo
- Messagerie masquée pour le déploiement portail / release app (`CHAT_MESSAGING_LIVE` / `FeatureFlags.chatMessagingLive`) tant qu’elle n’est pas sur le store

### Corrigé

- Validations sondage / réactions et MIME vignette chat

## [2.2.2] - 2026-09-12

### Modifié

- SHA debug et upload Android dans `google-services.json` (signature Play / debug)

## [2.2.1] - 2026-09-12

### Corrigé

- Build release Android (R8 / Stripe)
- Typage realtime côté portail

## [2.2.0] - 2026-09-12

### Ajouté

- Paiement des cotisations via **Stripe Connect Express** (frais CB, `application_fee`, flags live Flutter + App Hosting)
- Instrumentation cotisations Stripe (PostHog + Sentry / Crashlytics)
- Journal d’activité club (app, portail et Cloud Functions)
- Suivi cotisations enrichi : historique, corrections, repli PaymentSheet
- Push FCM (app + portail web) : rappels, annonces, cotisations, RSVP différées avec debounce, prefs et deep links
- Planning personnel multi-clubs (bureau et famille) ; redirection multi-profils vers Mon planning
- Formulaire nouvel événement retravaillé (lieux, RDV, UX) ; appel coach optionnel sans polluer le RSVP
- Wizard club-setup : lieux sportifs (Nominatim / Places), siège, effectifs, pastille « + » créer un club
- Invitations membres enrichies (bulk, progression, Cloud Functions) ; acceptation joueur / coach sur le portail web
- Upload logo club via callable Admin ; permission coach pour modifier les licences
- Textes UI centralisés dans `AppCopy` (voix « pote de vestiaire »)
- Voile de chargement logo ViroTeam ; pastilles multi-espace et nav alignée au club

### Modifié

- Config cotisations allégée (disclosure progressive) ; listes membres / cotisations clarifiées
- Planning : blocs filled/outline selon RSVP, type/détail séparés, toasts et sélecteur de club
- Création d’événement, labels planning et hub Équipes simplifiés
- Portail : rechargement temps réel, voile de nav, polish UI
- App verrouillée en mode portrait ; menus système déclarés en français (iOS / Android)
- Date jj/mm dans les rappels push événements ; bouton recharger retiré du dashboard home

### Sécurité

- Proxy Places sécurisé (auth Firebase + limitation par IP)
- Création club + membre fondateur autorisée en transaction

### Corrigé

- Préférence événements préservée pour le fallback RSVP legacy
- Lien siège, reprise brouillon club-setup et reporting Sentry
- RSVP planning immédiat sans pastille « Actualiser » indue

## [2.1.3] - 2026-09-04

### Sécurité

- Lot 1 : règles Firestore réécrites et testées (`rules-tests/`, 41 scénarios) — plus d’auto-promotion admin, rôle/statut/équipes non modifiables par le titulaire, `member_accounts` et `adminIds` réservés aux Cloud Functions
- Invitations lisibles uniquement par le club (coach/admin) ou l’e-mail invité ; recherche par code via `lookupInvitationByCode` (e-mail masqué) ; e-mail obligatoire à l’invitation ; un coach ne peut plus inviter un admin
- `acceptInvitation` réservée à l’e-mail invité ; correction d’index `member_accounts` (`memberId`)
- Callables `setMemberRole`, `removeMember` (garde « dernier admin ») et `deleteMyAccount` ; app et portail n’écrivent plus `users/{autre}` ni `member_accounts`
- Parents : lecture limitée aux équipes de leurs enfants (`parentTeamIds`) ; parents autorisés à lire les fiches membres pour le roster
- Webhook HelloAsso verrouillé par `HELLOASSO_WEBHOOK_TOKEN` ; reçus PDF en URL signée ; `receipts/**` fermé dans Storage
- Document club / fiches pré-créées moins exposés sans auth ; portail : plus de repli silencieux sur `v2-dev`

### Ajouté

- Double rôle coach/joueur (planning, RSVP accueil, cotisation)
- Page Équipe bureau et famille avec picker de club
- Popover RSVP ancré style agenda avec liste des convoqués
- Helpers cotisation et données home/membres pour le portail
- Parcours club-setup (partie 1) ; préparation beta interne TestFlight iOS

### Modifié

- Homes bureau / famille enrichies (cotisation, marque club, audience, planning)
- Shell dashboard : nav Équipe et alerte cotisation
- Urgence visuelle des rappels de cotisation (Flutter)

### Corrigé

- Crashes login et polices pour la review Play Store
- Onglet suivi cotisations : libellés corrompus (U+FFFD) ; test d’encodage des sources
- Routeur : redirection réactive aux changements de `signUpIntentProvider`
- iOS : projet prêt pour TestFlight interne (bundle `com.viroteam.viroTeam`, iOS 15, Google Sign-In, contournements Firestore / `path_provider_foundation`)

## [2.1.2] - 2026-08-29

### Corrigé

- Connexion sans fiche Firestore : redirection vers la création de compte au lieu d’une boucle sur la page Bienvenue
- Page Bienvenue : bandeau explicite et finalisation du profil pour utilisateurs Auth déjà connectés

## [2.1.1] - 2026-08-29

### Modifié

- Release Android conditionnée à une CI Flutter réussie sur le commit tagué

### Corrigé

- Tests CI compatibles Flutter 3.44 (`add_member_sheet`, session paramètres)
- `SettingsListTile` : ancêtre `Material` pour `ListTile` dans `ViroCard`

## [2.1.0] - 2026-08-29

### Ajouté

- Écran paramètres utilisateur (profil, e-mail, mot de passe, session)
- Écran paramètres club avec droits coachs et configuration saison cotisations
- Gestion inventaire équipements club (liste, formulaire, accès depuis l’accueil)
- Personnalisation apparence club : logo, couleurs bicolores, accents sur l’app
- Wizard création club refondu (étapes modulaires, persistance, récap, autocomplete adresse)
- PostHog wizard création club : événements `club_setup_started` / `club_setup_step_viewed` / `club_setup_completed` (sans PII)
- Invitations e-mail membres, fiches détail et édition pending
- Module parents (liste, mon parent, invitation) + callables Brevo
- Portail : Bureau coach/joueur, membres/parents, annonces, cotisations enrichies, planning
- CI/CD monorepo (release Android Play internal/prod, deploy portal/functions/firestore)

### Modifié

- Harmonisation politique mot de passe app + portail
- Deep links planning étendus, bannières portail retirées
- Accents club sur accueil, membres, planning, équipes, cotisations et annonces

### Corrigé

- Alignement appId Firebase Android sur `com.viroteam.viro_team`
- Messages d’erreur Auth en français

## [1.1.0] - 2026-08-27

### Ajouté

- Docs déploiement : [`docs/DEPLOY_IOS.md`](docs/DEPLOY_IOS.md), [`docs/DEPLOY_SUITE.md`](docs/DEPLOY_SUITE.md)
- Mentions légales (template), privacy enrichie, case CGU à l’inscription (app + portail)
- Bannière consentement cookies PostHog (portail)
- Suppression de compte in-app (Profil) + liens légaux
- Privacy Manifest iOS (`PrivacyInfo.xcprivacy`)
- Callable `acceptInvitation` complète (transaction Admin SDK) branchée côté Flutter
- Portail Bureau adapté coach / joueur : nav, home, membres, planning, annonces et cotisations self filtrés par rôle et équipes
- CI/CD : workflows deploy Functions (`functions-v*` / `functions-dev-v*`) et Firestore (`firestore-v*` / `firestore-dev-v*`) + `workflow_dispatch`
- Icône app ViroTeam (Android/iOS) + splash natif (logo + formes colorées)
- Portal planning : sélecteurs custom (heure, équipe) style Google Calendar
- Portal planning : picker invités multi (équipes, catégories, personnes) pour tournois et événements « Autre »
- Portal planning : persistance des filtres sidebar dans le localStorage
- FVM : Flutter 3.44.8 épinglé pour ce repo (SDK global boulot inchangé)
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

- Storage rules : upload logo club réservé aux admins (`v2-dev` / `v2-prod`)
- PostHog Android : DEBUG désactivé en release
- Info.plist iOS : `CFBundleName`, photo library, export compliance
- Portail : titre et meta description SEO (style marque + phrase d’autorité)
- CI/CD : path filters PR, release Android (Play internal/prod, environment `play-store`), deploy portal sur `firebase-prod`, docs secrets/tags alignées
- Portal planning : dialog création d'événement compacté et branché sur les nouveaux sélecteurs
- Portal planning : calendrier — survol des événements empilés et titres multilignes
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

- Portail : `/favicon.ico` manquant (logo Vercel dans Google) — favicon ViroTeam servi
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
