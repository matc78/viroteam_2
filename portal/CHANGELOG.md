# Changelog — Portail ViroTeam

Trace des déploiements Firebase App Hosting (tags `portal-v*`).

Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versions alignées sur les tags Git (`portal-vX.Y.Z`).

Avant chaque tag `portal-v*` : déplacer les entrées `[Unreleased]` vers la nouvelle section versionnée.

## [Unreleased]

### Sécurité

- Dépendances : Next.js 15.5.29, `@sentry/nextjs` 10.78 (tunnel `/monitoring`), remplacement de `xlsx` par `exceljs` pour l’import / modèle membres, overrides npm pour les transitives critiques/hautes (`@grpc/grpc-js`, `postcss`, `glob`, `uuid`, `tinypool`) — `npm audit --omit=dev` à 0

### Ajouté

- Planning : un admin (ou coach avec le droit `canEditMemberRsvp`) peut modifier le RSVP des convoqués depuis le détail d’événement
- Paramètres club : toggle « Modifier les réponses RSVP » pour les coachs (off par défaut)
- Messagerie (masquée), sondages : un vote enregistre aussi son heure (`pollVoteTimes.{uid}`, horodatage serveur, `edited` si changement), comme l’app — pas encore affichée dans le panneau des votes du portail

### Modifié

- Membres : bouton « Importer CSV » masqué sur téléphone (≤ 767 px)
- Membres : lecture / écriture Excel via `exceljs` (lazy-load) à la place de SheetJS `xlsx@0.18.5`

### Corrigé

- Messagerie (masquée) : un message avec beaucoup de réactions différentes n’affiche plus qu’une rangée de 4 emojis (les plus utilisés) puis « +n » (comme l’app) ; sur tes bulles, la rangée est ancrée à droite pour ne plus déborder du fil
- Messagerie (masquée) : « Changer la photo » du menu Options fonctionne aussi dans une conversation où l’on ne peut pas écrire ; un échec de suppression ou de renommage affiche une erreur au lieu d’échouer en silence
- Couleurs : huit variables CSS utilisées sans être définies (`--color-gray-500/700/800`, `--color-primary-300/700`, `--color-text`, `--color-text-muted`, `--color-border`) le sont désormais. Les textes secondaires retrouvent leur gris, et les bordures au survol (membres, équipes, annonces, import…) ne prennent plus la couleur du texte. Un test échoue si une variable `--color-*` utilisée n’existe pas
- Messagerie (masquée) : une conversation n’est plus marquée lue quand la page Messages est masquée ou l’onglet en arrière-plan
- Messagerie (masquée) : le bandeau d’un canal dit qui peut écrire (admins seuls, ou coachs et admins) et ne s’affiche plus pendant le chargement
- Messagerie (masquée) : noms, photos et rôles des participants lus sur la conversation (`participantProfiles`) — un parent les voit, sans lecture des membres un par un
- Messagerie (masquée) : les séparateurs de jour du fil ont une clé par jour local (et non UTC) — deux jours consécutifs autour de minuit ne partagent plus la même clé React
- Messagerie (masquée) : une erreur de chargement de l’inbox (ou du fil) n’est plus avalée — message d’erreur avec « Réessayer » ; une recherche sans résultat affiche « Aucune discussion ne correspond… » au lieu de l’inbox vide ; le placeholder de recherche décrit ce qu’elle filtre (nom, club, dernier message)
- Messagerie (masquée) : Entrée n’envoie plus le message pendant une composition IME (accents, kana…) ; le champ garde le focus pendant l’envoi
- Messagerie (masquée) : la pastille du club prend la couleur du club partout, y compris dans la fenêtre flottante ; titres longs tronqués en CSS (inbox, en-tête du fil, fenêtre flottante)

### Ajouté

- Messagerie (masquée), accessibilité : bouton « Actions du message » au survol et au focus clavier (plus besoin du clic droit) ; suppression confirmée dans le menu d’actions au lieu d’une boîte `window.confirm` ; menus Options et « + » navigables aux flèches (Échap ferme le menu, pas la fenêtre) ; panneaux infos / sondage et fenêtre flottante non modaux (focus à l’ouverture, Échap, Tab peut en sortir pour rejoindre le dock) ; le lecteur d’écran annonce uniquement les messages reçus (« Nouveau message de … »), plus tout le fil ; formulaires sondage, renommage et création avec libellés et erreurs annoncées
- Messagerie (masquée), mobile (< 768 px) : la page Messages affiche la liste ou le fil en plein écran, avec un bouton retour ; points de rupture du chat ramenés à 767 et 1024 px (`ChatBreakpoints`, vérifié par un test)
- Messagerie (masquée) : envoi optimiste (le message apparaît tout de suite en « Envoi… », « Échec · Réessayer » cliquable sinon), bouton flottant « Derniers messages » / « n nouveaux messages », historique chargé automatiquement en remontant (position de lecture conservée)
- Messagerie (masquée) : squelette au chargement du fil, état vide (« Envoie le premier message… » si tu peux écrire), erreur avec « Réessayer »
- Messagerie (masquée) : recherche dans le fil avec compteur « 2 / 5 », navigation précédent / suivant (boutons, Entrée / Maj+Entrée) et résultat courant mis en évidence
- Messagerie (masquée) : modification d’un message directement dans le composer (bandeau « Modification » + Annuler, Entrée enregistre, Échap annule) — la boîte de dialogue de modification est supprimée
- Messagerie (masquée) : mute, favori et réactions appliqués tout de suite, annulés avec un message d’erreur si l’écriture échoue

### Modifié

- Messagerie : visible en local (`NEXT_PUBLIC_CHAT_MESSAGING_LIVE`) ou si `users/{uid}.flags.chatMessaging` ; sinon dock / tuile / panneau Messages masqués (redirect `/messages` → home)
- Messagerie (masquée) : mes bulles en couleur d’accent pleine (texte et liens clairs), celles des autres en surface carte avec la bordure de rôle ; messages consécutifs regroupés comme dans l’app (même expéditeur, même jour, < 5 min, sans séparateur, hors supprimés et sondages) — nom sur le premier, avatar et « queue » sur le dernier, écart `--chat-message-group-gap` (2 px)
- Messagerie (masquée) : photos du fil au gabarit de l’app (220 px de large, hauteur au ratio bornée 120–320 px, place réservée avant chargement, fond de chargement, « Photo indisponible » en cas d’erreur)
- Messagerie (masquée) : avatars aux tailles `--chat-avatar-*` (inbox 44, en-tête du fil 36 — nouvel avatar —, expéditeur 28, votant 22, fiche 88) ; `MemberAvatar` accepte un diamètre libre (`diameter`)
- Messagerie (masquée) : boutons rapides du panneau infos « Couper » / « Réactiver » (libellés accessibles « Couper les notifs » / « Réactiver les notifs ») au lieu de « Mute » / « Notifs »
- Messagerie (masquée) : `ChatThreadView` découpé en hooks et composants (`components/chat/thread/`), logique pure dans `lib/chat/` (`buildThreadRows`, `filterInbox`, `isMessagesPath` unique), tests vitest ajoutés ; rendu inchangé
- Messagerie (masquée) : socle visuel commun avec l’app — tokens `--chat-*` (bulles, citations, avatars, couleurs du fil) dans `globals.css`, couleurs en dur des modules chat remplacées par des variables (thème sombre possible), classes dupliquées factorisées dans `chatShared.module.css`, textes regroupés dans `chatCopy`. Seul changement visible : les bulles vont jusqu’à 78 % de la largeur du fil (85 % avant)

## [1.13.0] - 2026-11-02

### Ajouté

- Planning : bouton « Modifier » dans le détail d’un événement (admin, ou coach d’une de ses équipes) : date, heures, lieu, lieu de RDV, et titre pour une réunion ou un « autre ». Une seule occurrence est modifiée, même dans une série ; seuls les champs changés sont écrits, et les convoqués sont prévenus par notification (« reporté » ou « modifié »)

## [1.12.0] - 2026-10-30

### Modifié

- Page d’accueil : refonte autour du message « configurez votre saison une fois, ViroTeam s’occupe du reste ».
  - Bouton principal « Créer mon club gratuitement » (hero, en-tête, bandeau final) ; les badges stores passent en second, pour joueurs et parents.
  - Bande de chiffres réels de l’USMV Volley-Ball, dont « 0 relance manuelle ».
  - Section sur la mise en place en début de saison et les automatismes.
  - Récit « Une semaine avec ViroTeam » en onglets par jour, calé sur les vrais horaires des notifications.
  - Espace bureau et Rôles en onglets, avec les vraies captures de l’app dans des cadres de téléphone.
  - Section Tarifs : gratuit pendant la bêta ; seul le paiement CB des cotisations a un coût, payé par le membre, avec un exemple chiffré.
  - FAQ réduite à 6 questions, dont le prix et la protection des données ; contact direct du développeur (`site.contactEmail`).
  - Couleurs : l’indigo du logo (`--color-brand`) domine ; orange, vert, jaune et cyan en touches, comme dans l’espace club.
  - Mise en page alignée à gauche, sans texte justifié ; confettis géométriques (triangles, anneaux, losanges…) dans les marges des sections blanches ; photos de banque d’images retirées.

### Corrigé

- Page d’accueil : les titres de section ne passent plus sous les captures sur desktop. Ils étaient forcés sur une seule ligne.
- Page d’accueil : avec « réduire les animations » activé, les sections animées restaient invisibles (`opacity: 0`) à cause d’un écart d’hydratation serveur / client.
- En-tête et pied de page : les liens de section fonctionnent depuis les pages de connexion (`/#…` au lieu de `#…`).

## [1.11.0] - 2026-10-28

### Ajouté

- Paramètres > Notifications (bureau) : choix du moment du bilan des réponses envoyé aux coachs (2 jours avant, la veille au soir, avec le rappel du jour J)

### Corrigé

- Planning et accueil : le jour d’un événement vient de `dateId` (ou du jour UTC), plus du fuseau du navigateur. Avant, il s’affichait la veille à partir de UTC-3 (Antilles, Guyane, Québec).
- Cotisations : paiement hors ligne, ajustement, aides et statut passent par une transaction ; deux validations simultanées ne s’écrasent plus.

### Sécurité

- Rejoindre un club / suivi parent : si l’e-mail du compte n’est pas confirmé, le portail propose d’envoyer le lien de confirmation puis relance l’acceptation.
- En-têtes HTTP sur toutes les pages : `frame-ancestors 'none'` / `X-Frame-Options: DENY` (plus de chargement du bureau dans une iframe), HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Suppression de la connexion dev sans mot de passe (`/api/dev/auth/token`, `NEXT_PUBLIC_DEV_AUTH_BYPASS`), qui émettait un jeton valable aussi en prod. L’aperçu du wizard sans compte passe par `NEXT_PUBLIC_CLUB_SETUP_PREVIEW`.

### Modifié

- Membres : plus de réparation `teamIds` / rosters en arrière-plan à chaque session admin, la synchro est faite côté serveur.
- Tableaux de bord : l’écoute temps réel des événements commence à hier et celle du journal d’activité se limite à la dernière entrée, au lieu de relire tout l’historique.

## [1.10.0] - 2026-10-23

### Ajouté

- Convocations : un coach / admin peut retirer des joueurs des convoqués. Création de match : liste des joueurs de l’équipe, tous cochés par défaut (décocher = ne joue pas). Planning : action « Gérer les convoqués » dans le détail d’un événement à venir (cocher / décocher, « Cette séance » ou « Celle-ci et les suivantes » pour une série), via la callable `updateEventConvocations`
- Un joueur retiré (`excludedMemberIds`) ne voit plus l’événement dans le planning, l’accueil et l’espace famille ; la synchro des rosters ne le réintègre jamais
- Analytics PostHog (après accord du bandeau cookies) : identification par uid Firebase (rôle max, parent, nombre de clubs, date d’inscription ; ni nom ni e-mail), groupe `club` pour le club actif, propriété `surface: portal`, `reset` à la déconnexion. Mêmes clés que l’app mobile pour croiser web et mobile
- Liens « Télécharger l’app » marqués par campagne (badges stores : `store_badges`, messages d’invitation copiés : `invite_share`) pour la Play Console et App Store Connect

### Modifié

- Confidentialité : mention des compteurs d’usage par club envoyés par nos serveurs à PostHog, sans identifiant ni donnée personnelle
- Création d’événement : Lieu en dropdown des lieux de pratique du club (1er par défaut + option « Autre »), saisie libre seulement pour match extérieur ou Autre
- Politique de confidentialité : mesure d’audience de l’app et du portail détaillée (données collectées, consentement)

### Supprimé

- Firebase Analytics, qui se chargeait sans attendre le consentement cookies (doublon de PostHog)

### Corrigé

- Équipes : le retrait d’un membre et la synchro des alias d’audience nettoient / migrent aussi `rsvpUpdatedAt` et `seenAt` (plus de dates de vote orphelines)

## [1.9.0] - 2026-10-21

### Ajouté

- Mot de passe oublié : page `/forgot-password` (lien depuis la connexion) et envoi du lien Firebase de réinitialisation, avec message neutre si le compte n’existe pas
- Création d’événement : case « Événement important » (rappel 7 jours avant), cochée d’office pour un tournoi ou une réunion
- Paramètres > Notifications : « Récap de la semaine » et « Réponses des coéquipiers » ; libellés alignés sur le nouveau calendrier des rappels (tutoiement)

### Corrigé

- Les préférences de notification enregistrées depuis le portail n’écrasent plus les nouveaux réglages faits dans l’app

### Note

- Messagerie toujours masquée en prod (`CHAT_MESSAGING_LIVE` / `NEXT_PUBLIC_CHAT_MESSAGING_LIVE` absent d’App Hosting)

## [1.8.0] - 2026-10-21

### Ajouté

- App Check web (reCAPTCHA Enterprise, score invisible) via `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` — à activer en console puis Enforce Auth/Firestore
- Type d’événement « Réunion » (`meeting`, aligné app) : choix dans la création d’événement (titre facultatif, invités optionnels), badge cyan sur les tuiles planning
- Invités « Tout le club » pour les réunions et événements « Autre » : convoque chaque équipe et chaque membre (`allTeams`), l’événement apparaît alors dans le planning de tout le club ; l’aide du champ précise que seuls les invités le voient

### Corrigé

- Message `auth/internal-error` : indication App Check / debug token en local au lieu du libellé brut Firebase

## [1.7.0] - 2026-10-20

### Ajouté

- Navigation des modules (bureau et famille) : barre de chargement teintée à la couleur de l’onglet ciblé, qui se remplit de gauche à droite en fond de la ligne d’onglets jusqu’au chargement des données ; même animation dans les boutons du header (pastilles club, Mon planning, Messagerie)

### Corrigé

- Listener cotisations temps réel : plus d’écoute de toute la collection `member_fees` tant que l’id fiche n’est pas connu (permission-denied / overlay Next en vue joueur ou parent)
- Onglet Parents : plus de liste vide ou données du club précédent juste après un changement de pastille club
- Déconnexion : vidage du cache Firestore mémoire et du cache lien compte → fiche
- Connexion Google : fermeture de la popup sans message d’erreur fantôme
- Planning admin : calendrier vide quand aucune équipe n’était cochée — pré-coche toutes les équipes (comme le coach)
- Doublons de convoqués sur le détail événement (même personne listée deux fois via memberId + accountUid) : sync audience qui migre les alias et liste dédupliquée
- Loaders sans fin : popup Google fermée, profil / clubs illisibles au chargement de session (écran « Réessayer » au lieu d’un faux déconnecté), `/join` quand le rafraîchissement du profil échoue, panneau participants de la messagerie, garde « Redirection… » interrompue, pages famille sans enfant ciblé
- Inscription : profil lu avant sa création (« Profil introuvable » dans l’assistant club)
- Déconnexion bloquée par le désenregistrement push (borné à 2 s)

### Modifié

- Sidebar planning : filtre Joueur retiré ; Coach et Catégorie conservés pour l’admin
- Fluidité : plus de voile plein écran entre modules (squelette immédiat) ; voile seulement au changement de club, après 300 ms
- Chargement : un chunk JS par module (préchargés en tâche de fond), `xlsx`, `firebase/analytics`, push web et Sentry Replay chargés à la demande, traces Sentry échantillonnées en prod — environ 30 % de JS en moins sur `/home`
- Données : membres sans lecture par fiche (snapshot + invitations en une requête), parents chargés à l’ouverture de l’onglet Parents, réparations convocations / `teamIds` en arrière-plan une fois par session, cascades parallélisées (accueils, famille, cotisations), cache Firestore mémoire LRU, listeners planning bornés à un mois
- Session : invitations parent réclamées hors chemin critique, une seule lecture par club

### Note

- Messagerie toujours masquée en prod (`CHAT_MESSAGING_LIVE` / `NEXT_PUBLIC_CHAT_MESSAGING_LIVE` absent d’App Hosting)

## [1.6.0] - 2026-10-12

### Ajouté

- Lien App Store actif (`site.appStoreUrl`) : badge iOS, CTA landing, FAQ SEO et mentions légales

### Corrigé

- Indexation Search Console : redirect 301 apex (`viroteam.com`) → `www` via middleware (`X-Forwarded-Host`), canonicals absolues sur landing et pages légales — les URL `http://` restent exclues (redirection HTTPS normale)

### Note

- Messagerie toujours masquée en prod (`CHAT_MESSAGING_LIVE`)

## [1.5.0] - 2026-09-29

### Ajouté

- CGU : section « Paiement des cotisations » (optionnel, via Stripe, commission 1 € TTC par paiement CB affichée avant validation, reçu, remboursements gérés par le club, éditeur non partie au contrat de cotisation)
- Badge App Store branché sur `site.appStoreUrl` : lien actif dès que l’URL est renseignée, « bientôt » sinon ; `operatingSystem` du JSON-LD déduit des URLs store

### Modifié

- Politique de confidentialité : Stripe remplace HelloAsso dans les sous-traitants ; ajout de Firebase Cloud Messaging (push), Google Sign-In et Sign in with Apple ; données de paiement et jeton push listés ; date au 28 septembre 2026
- Mentions légales : service gratuit pour clubs et membres, paiement en ligne optionnel via Stripe avec commission de service de 1 € TTC par paiement CB (plus de mention « sans activité commerciale »)
- Récapitulatif de paiement CB (cotisations, espace famille) : les frais affichés précisent « paiement sécurisé + 1 € pour ViroTeam » (libellé unique `CARD_FEE_NOTICE`)

## [1.4.4] - 2026-09-22

### Ajouté

- Fichier clé IndexNow à la racine (`/{key}.txt`) pour Bing Webmaster

### Corrigé

- Balises `canonical` sur les pages légales (`/legal/cgu`, `/privacy`, `/mentions`) pour lever le « Duplicate without user-selected canonical » Search Console

### Modifié

- Messages d’invitation WhatsApp alignés sur la voix Guy (partage)

## [1.4.3] - 2026-09-18

### Modifié

- Meta SERP raccourcie ; H1 landing crawlable pour Bing

## [1.4.2] - 2026-09-18

### Corrigé

- `prefer-const` dans `chatService` (échec lint CI)

## [1.4.1] - 2026-09-18

### Note

- Tag de redéploiement (même commit que `1.4.0`)

## [1.4.0] - 2026-09-18

### Ajouté

- Messagerie in-app portail (types, service, callables, thread, dock, sondages, réactions, réponses, panel infos, deep links)
- SEO landing : sitemap XML, `robots.txt` élargi, JSON-LD, FAQ marketing, redirect apex → `www`
- Activation roster et import membres sans e-mail obligatoire

### Modifié

- Reverse proxy PostHog et DSN Sentry EU
- Logo Play Store aux couleurs officielles

### Sécurité / flags

- Messagerie masquée en prod (`NEXT_PUBLIC_CHAT_MESSAGING_LIVE` absent d’App Hosting) jusqu’à release store

## [1.3.1] - 2026-09-12

### Note

- Alignement suite app `2.2.x` (Stripe, push, planning) — voir changelog monorepo

## [1.3.0] - 2026-09-12

### Note

- Déploiement portail aligné release app `2.2.0`

## [1.2.0] - 2026-09-08

### Note

- Déploiement portail (tag `portal-v1.2.0`)

## [1.1.0] - 2026-08-27

### Note

- Déploiement portail (tag `portal-v1.1.0`)

## [0.4.0] - 2026-08-21

### Note

- Déploiement portail (tag `portal-v0.4.0`)

## [0.3.0] - 2026-08-19

### Note

- Déploiement portail (tag `portal-v0.3.0`)

## [0.2.0] - 2026-08-19

### Ajouté

- PostHog, Sentry et Firebase Analytics

## [0.1.0] - 2026-08-13

### Ajouté

- Premier déploiement App Hosting via tags `portal-v*`
