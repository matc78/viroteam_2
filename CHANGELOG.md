# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.
Le changelog dédié aux déploiements App Hosting est dans [`portal/CHANGELOG.md`](portal/CHANGELOG.md) (tags `portal-v*`).

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Versioning Sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Corrigé

- Onboarding / invitation : « Se déconnecter » / « Utiliser un autre compte » sur club-setup, preview d’invitation et entry quand on est déjà connecté — évite d’être coincé sans club (mauvais e-mail vs invitation)
- Connexion depuis une invitation : conserve l’intent `join` pour ne plus forcer le wizard création de club

## [2.2.11] - 2026-10-23

### Ajouté

- Détail d’événement : horodatage du dernier vote RSVP (`12/10 · 13h45`, heure serveur) à gauche de l’icône sur chaque tuile membre, lu sur la même clé que le statut
- Convocations : statut « vu » — un œil à côté de « En attente » quand le membre a vu l’événement sur sa home (carte affichée ≥ 1 s) sans répondre ; pour un enfant, la vue du planning par le parent compte (callable `markEventSeen`)
- Convocations : le coach peut retirer des joueurs d’un événement (détail > « Gérer les convoqués »), pour une séance ou « celle-ci et les suivantes » d’une série ; un joueur retiré ne voit plus l’événement et ne reçoit aucune notif, et la synchro d’équipe ne le reconvoque pas (champ `excludedMemberIds`, callable `updateEventConvocations`). Réintégré, il reçoit « Nouvelle convocation » (≤ 7 j), même sur une série
- Création de match : liste des joueurs de l’équipe, tous convoqués par défaut, à décocher / recocher
- Mesure d’audience sur consentement : une feuille « Tu nous files un coup de main ? » s’affiche une fois sur l’accueil (accepter / refuser au même niveau), et le choix reste modifiable dans Paramètres > Mesure d’audience. Sans accord, rien n’est envoyé à PostHog
- Analytics PostHog : identification par uid Firebase (rôle max, parent, nombre de clubs, date d’inscription ; ni nom ni e-mail), groupe `club` pour le club actif (nom, sport, effectif), suivi des écrans par motif de route, `reset` à la déconnexion. Mêmes clés que le portail pour croiser web et mobile
- Plan de taggage `docs/analytics_events.csv` et guide `docs/ANALYTICS.md` (tableaux de bord, alertes, stores, rituel du lundi) ; script `tool/posthog_dashboards.mjs` qui crée les tableaux Santé, Activation, Rétention et Cotisations via l’API PostHog
- Functions : événements clés envoyés à PostHog côté serveur, rattachés au club seul (aucun uid) — `signup_completed` (anonyme), `club_created`, `invitation_sent`, `invitation_accepted`, `join_code_used`, `guardian_linked`, `event_created`, `convocation_sent`, `rsvp_set`, `fee_payment_succeeded` ; nouveaux triggers `onClubCreatedForAnalytics` / `onUserCreatedForAnalytics` (+ `Dev`)
- Liens stores marqués par campagne (Play `referrer` UTM, App Store `ct`) dans les messages d’invitation de l’app et les e-mails d’invitation

### Modifié

- PostHog initialisé par l’app (`AUTO_INIT` désactivé sur Android / iOS) : projet « ViroTeam prod » en release uniquement, projet « ViroTeam dev » sinon (`ProjectConfig.posthogDevApiKey`, vide = aucun envoi)

### Supprimé

- Firebase Analytics (doublon de PostHog) : paquet `firebase_analytics` et observateur de routes retirés

### Corrigé

- Détail d’événement : plus de titres / heures en rouge juste après l’ouverture de l’app — l’accent club réutilise la couleur déjà connue sur l’accueil au lieu d’un fallback preset

### Note

- Version app : `pubspec.yaml` / `ProjectConfig` en `2.2.11+17`

## [2.2.10] - 2026-10-22

### Ajouté

- Mode sombre : l’app suit le réglage clair / sombre du téléphone par défaut, et Paramètres > Apparence permet de forcer Clair ou Sombre (choix mémorisé sur l’appareil, appliqué dès le lancement)

### Modifié

- Couleurs de l’app centralisées dans une palette sémantique (`ViroPalette`) commune aux thèmes clair et sombre ; les couleurs de club trop foncées sont éclaircies en mode sombre pour rester lisibles
- Logos ViroTeam (`ViroLogo` / `ViroLogoMark`) affichés en blanc en mode sombre pour rester lisibles sur le fond sombre
- Mode sombre plus lisible sur l’accueil : couleurs de club ravivées (type d’événement, pastille club), accents bleus plus clairs, et halo « néon » discret sur les dates du planning, le bouton Réglages et le bouton d’ajout de club
- Splash natif (Android / iOS, y compris Android 12) : variante sombre (fond `#0B1220`, logo blanc) quand le téléphone est en mode sombre — plus de flash blanc au cold start

### Note

- Version app : `pubspec.yaml` / `ProjectConfig` en `2.2.10+16`

## [2.2.9] - 2026-10-21

### Ajouté

- Notifications : nouveau calendrier des rappels d’événements — rappel 2 jours avant (sans réponse ou « peut-être », plus bilan coach avec le décompte) et rappel le jour J à 8h00 (la veille au soir pour un event avant 10h00), 7 jours sur 7 ; rappel 7 jours avant réservé aux événements marqués « Événement important » (coché d’office pour un tournoi ou une réunion)
- Récap de la semaine le dimanche soir : une notif par personne (tous clubs et enfants confondus) avec le programme et les réponses attendues, envoyée seulement s’il y a au moins un événement ; désactivable dans les paramètres
- Notif « Nouvelle convocation » à la création d’un événement dans les 7 jours (hors séries récurrentes), et aussi quand un joueur est ajouté à l’audience d’un événement déjà créé (sync roster / rattachement)
- Préférence « Réponses des coéquipiers » (désactivée par défaut) pour suivre qui vient
- Tap sur une notif d’événement : l’événement est mis en avant dans le planning ; pour un parent, l’enfant concerné est sélectionné

### Modifié

- Textes des notifications réécrits (tutoiement) : équipe, type, jour et heure dans le titre, lieu / RDV et action attendue dans le corps ; prénom de l’enfant pour les parents ; « modifié » dit ce qui a changé (lieu, lieu de RDV, heure de RDV, fin…) ; nom du club pour les annonces et cotisations
- Réponses aux convocations : envoyées aux coachs (aux admins à défaut) avec le décompte oui / non / sans réponse, plus une confirmation aux parents quand la réponse de leur enfant est posée par quelqu’un d’autre ; plus envoyées à tous les coéquipiers par défaut
- Modifications d’un événement regroupées sur 2 minutes en une seule notif
- L’auteur d’une annonce ne reçoit plus sa propre notif ; la relance manuelle du coach n’est plus envoyée à ceux qui ont répondu Non

### Corrigé

- Écran ouvert depuis une notif (planning, cotisation, messagerie…) : le bouton retour et le retour Android remontent vers le club / l’accueil au lieu de ne rien faire ou de fermer l’app
- Rappels J-2 jamais envoyés pour les événements du lundi et du mardi (et J-7 pour ceux du week-end) : les rappels tournent désormais tous les jours
- Un report d’événement n’est plus remplacé sur le téléphone par un rappel envoyé juste après
- Ouverture à froid depuis une notif : le club et l’enfant sont posés avant d’afficher l’écran
- Changement du lieu de RDV (`meetingLocation`) : notifie désormais l’audience (comme l’heure de RDV)

### Note

- Version app : `pubspec.yaml` / `ProjectConfig` en `2.2.9+15`
- Messagerie toujours masquée en release (`FeatureFlags.chatMessagingLive`)

## [2.2.8] - 2026-10-20

### Ajouté

- App Check (attestation invisible) sur l’app Flutter : providers debug hors release, Play Integrity / App Attest en release — freine les créations de comptes bot sans captcha ni friction UX
- Script admin `tool/cleanup_orphan_auth_users.mjs` pour lister / supprimer les comptes Auth orphelins bot-like (dry-run par défaut)
- Mot de passe oublié sur l’écran de connexion (e-mail de réinitialisation Firebase) ; le changement de mot de passe reste disponible dans les paramètres uniquement pour les comptes e-mail / mot de passe
- Messagerie in-app (Flutter + portail) : threads, DM, sondages, réactions, réponses, panel infos, dock flottant, deep links et notifications
- Backend chat : sync équipes, triggers Cloud Functions et règles Firestore
- Activation roster et import membres sans e-mail obligatoire (portail)
- Specs et roadmap messagerie v2
- SEO landing : sitemap XML (route handler), `robots.txt` élargi, JSON-LD enrichi, mots-clés ciblés, FAQ marketing élargie, redirect `viroteam.com` → `www.viroteam.com`
- Contrôle d’alignement de version `pubspec.yaml` ↔ `ProjectConfig` ↔ tags (`tool/check_app_version.mjs`) branché en CI et Release Android
- Planning du club (app, coachs et admins) : vues Semaine et Mois en plus de la vue Jour — agenda de la semaine regroupé par jour, grille mensuelle avec pastilles par type d’événement (légende) et événements du jour sélectionné, navigation période précédente / suivante ; une seule requête Firestore par période
- Type d’événement « Réunion » (`meeting`) : création dans l’app (sans équipe, titre facultatif) et le portail (invités optionnels), icône groupe, pastille cyan dans le planning et la légende
- Création d’une réunion ou d’un événement « Autre » dans l’app : choix des convoqués (« Tout le club » par défaut, ou une sélection d’équipes). Seuls les convoqués voient l’événement dans leur planning ; « Tout le club » convoque chaque membre, y compris ceux sans équipe (avant : aucun convoqué, événement visible du seul staff)

### Corrigé

- Parcours « rejoindre un club » : plus de stack Firebase brute si la vérification du code échoue ; lien « Déjà un compte ? » et, après un code valide, aperçu avec choix créer un compte / se connecter ; CTA « Ouvrir le club » si déjà membre
- Icône de notification Android : silhouette monochrome du logo ViroTeam (PNG par densité) à la place du « V » placeholder — évite le disque blanc quand le système retombait sur l’icône launcher opaque ; FCM envoie aussi explicitement `icon` + teinte marque
- Planning portail admin : pré-coche toutes les équipes si aucune sélection (évite un calendrier vide) ; filtre Joueur retiré de la sidebar
- Planning du club en vue enfant (parent) : le RSVP (tuile et fiche) s’applique à l’enfant sélectionné via la callable `setEventRsvp`, et le statut affiché est celui de l’enfant (avant : celui du parent, ou RSVP impossible pour un parent sans fiche)
- Doublons de convocations (memberId + accountUid) après acceptation d’invitation : migration des events à la reconcilation roster, sync audience sans empiler les alias, liste / compteurs portail dédupliqués
- Push d’annonce « Tous les membres » jamais envoyée en prod : la requête des parents actifs exigeait un index Firestore absent (`FAILED_PRECONDITION`). Elle filtre désormais par `clubId` (index composite `guardians (clubId, status)`) au lieu de lire les liens parent de tous les clubs
- Index de portée collection group sur `guardians.parentUid` (requête de suppression de compte)
- `functions/README.md` : encodage réparé (accents et tirets remplacés par `?` / `�`)
- Validations sondage / réactions et MIME vignette chat

### Sécurité

- App Check côté clients (app + portail) avec Enforce Auth / Firestore (voir `docs/DEPLOY_SUITE.md`)
- Durcissement des règles chat (réactions et preview inbox)

### Modifié

- Détail d’événement (sheet planning) : pastilles RSVP cliquables comme sur la tuile pour modifier sa présence
- Textes landing (hero, sections, FAQ, CTA) pour refléter planning, membres, cotisations et app club
- Reverse proxy PostHog et DSN Sentry EU
- Badge / logo Play Store aux couleurs officielles
- Ignore le `node_modules` npm installé par erreur à la racine du monorepo
- Messagerie masquée pour le déploiement portail / release app (`CHAT_MESSAGING_LIVE` / `FeatureFlags.chatMessagingLive`) tant qu’elle n’est pas sur le store

### Note

- Version app : `pubspec.yaml` / `ProjectConfig` en `2.2.8+14`

## [2.2.7] - 2026-10-19

### Ajouté

- Mise à jour obligatoire : écran bloquant « Va télécharger l’update ! » avec lien vers le store quand la version installée est sous la version minimale de `app_config/mobile` (`minVersionAndroid` / `minVersionIos`, lisible sans connexion, écrit à la console uniquement)
- Notifications push affichées même avec l’app ouverte, sur Android comme sur iOS (`flutter_local_notifications`), sauf si l’écran affiche déjà le contenu (conversation ouverte)
- Canaux de notification Android par catégorie (événements, annonces, messages, cotisations, réponses de présence), icône de notification monochrome (placeholder) et teinte de marque
- Regroupement des push : une push d’un même événement / d’une même annonce remplace la précédente (tag Android, `apns-collapse-id`), messages groupés par conversation sur iOS (`thread-id`)
- Pré-demande de permission notifications sur la home (club actif requis, 3 fois max, espacées de 7 jours, seulement tant que la popup système peut encore s’afficher) au lieu de la popup système au premier lancement
- Paramètres > Notifications : bandeau quand les notifs sont coupées sur le téléphone, avec accès direct aux réglages système ; interrupteurs grisés tant que c’est le cas
- Log structuré `push sent` (destinataires, tokens, succès / échecs) à chaque envoi de push ; un token rejeté par FCM est purgé avec son entrée `fcmTokenIndex`
- Checklist de test manuel des push : `docs/PUSH_SMOKE.md`
- `CLAUDE.md` pour Claude Code (commandes, architecture dev/prod, conventions) ; `PROJECT_CONVENTIONS.md` et README réalignés sur le code

### Corrigé

- Dates décalées autour des changements d’heure (ajout de `Duration(days: n)` sur des dates locales) : jours en double / décalés dans le sélecteur du planning, séances récurrentes hebdo créées la veille après le passage à l’heure d’hiver, « Demain » / « Hier » faux le jour du changement, fenêtre « à venir » et écart en jours décalés au printemps. Nouveau helper `addCalendarDays` / `calendarDaysBetween` (`lib/utils/calendar_days.dart`)
- Release iOS : `pod update` si `Podfile.lock` pinne un Firebase SDK trop ancien pour FlutterFire (blocage CocoaPods sur `Firebase/Functions`)

### Note

- Version app : `pubspec.yaml` / `ProjectConfig` en `2.2.7+13`
- Messagerie toujours masquée en release (`FeatureFlags.chatMessagingLive`)
- Règle Firestore `app_config` à déployer (`firestore-dev-v*` / `firestore-v*`) avant que le seuil `minVersion*` soit renseigné en prod

## [2.2.6] - 2026-10-19

### Ajouté

- Codes d’invitation d’équipe multi-usage
- Acceptation CGU à la création de compte
- RSVP cliquable sur les tuiles du planning club

### Modifié

- Lieux de pratique sans auto-lien au siège
- Mails d’invitation : CTA stores et liens web
- Accessibilité pragmatique app et portail
- Icônes de status bar en sombre sur fond clair

### Note

- Version app : `pubspec.yaml` / `ProjectConfig` en `2.2.6+12`
- Messagerie toujours masquée en release (`FeatureFlags.chatMessagingLive`)

## [2.2.5] - 2026-10-15

### Corrigé

- Onboarding fondateur : connexion sociale, Places et gymnase par défaut
- Sync du nom de profil vers les fiches membres du club

### Note

- Messagerie toujours masquée en release (`FeatureFlags.chatMessagingLive`)

## [2.2.4] - 2026-10-12

### Modifié

- Pull-to-refresh natif simplifié et `scrollPhysics` unifiés (`ViroRefreshIndicator`)
- Outillage captures store : `--dart-define=FORCE_PROD_BACKEND` / `SKIP_PUSH_PERMISSION` + test d’intégration

### Corrigé

- Podfile iOS : cibles pods forcées ≥ 15.0 (compat Xcode 27)

### Note

- Messagerie toujours masquée en release (`FeatureFlags.chatMessagingLive`)

## [2.2.3] - 2026-09-29

### Modifié

- Version app : `pubspec.yaml` / `ProjectConfig` en `2.2.3+7`

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
