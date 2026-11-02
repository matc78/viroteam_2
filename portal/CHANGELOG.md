# Changelog — Portail ViroTeam

Trace des déploiements Firebase App Hosting (tags `portal-v*`).

Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versions alignées sur les tags Git (`portal-vX.Y.Z`).

Avant chaque tag `portal-v*` : déplacer les entrées `[Unreleased]` vers la nouvelle section versionnée.

## [Unreleased]

### Modifié

- Mon compte : la page occupe toute la largeur disponible ; en écran large, Compte et Mes clubs à gauche, Notifications à droite (une seule colonne sinon).
- Barre latérale plus colorée : chaque module a sa pastille d’icône teintée (pleine quand il est actif), lavis bleu et liseré multicolore en tête, rôle de chaque club en couleur (Joueur, Coach, Admin, Parent), avatar initiales en dégradé.
- Planning : la réponse à une convocation s’affiche immédiatement sur le calendrier (bloc plein, contour…) ; l’enregistrement et la resynchronisation se font en arrière-plan, sans voile de rechargement.
  - Samedi et dimanche ne sont plus grisés ; seuls les jours hors du mois affiché le restent en vue Mois.
  - Chaque réponse a son rendu : plein (présent), hachuré (peut-être), atténué et barré (absent), contour (sans réponse).
  - Titre de période homogène (« 26 oct. – 1 nov. 2026 », « Novembre 2026 »), en-tête des jours de la vue Mois intégré à la grille et collé en haut au défilement, flèches de navigation en icônes.
- Refonte visuelle de l’espace connecté (bureau et famille).
  - Navigation en barre latérale : club actif en menu déroulant (avec « Créer un club »), modules avec icônes, Mon planning, Messagerie et compte en bas ; top bar + menu tiroir sur mobile.
  - Barre latérale repliable en icônes seules (préférence mémorisée dans le navigateur).
  - Sur Mon planning, Messagerie et Mon compte, tous les clubs sont listés directement dans la barre latérale.
  - Cotisation dans la nav pour les joueurs (« Ma cotisation ») et les parents (« Cotisations »).
  - Accueil joueur / parent : prochain rendez-vous mis en avant avec la réponse à donner, puis la suite du programme ; cotisation (montant et bouton « Régler ») et annonces en colonne ; compteur de réponses attendues.
  - Accueil admin : bandeau « À traiter » cliquable en tête, 4 chiffres clés, prochains événements avec barre présents / absents, cotisations, annonces et 3 dernières actions.
  - Accueil coach : réponses en attente, semaine à venir, événements de ses équipes avec les réponses, liste de ses équipes.
  - Cotisations (staff) : l’onglet Suivi s’ouvre par défaut, avec encaissé, reste dû, fiches soldées, actions en attente et l’histogramme des encaissements.
  - Cartes neutres, couleur réservée aux statuts ; boutons RSVP en sélecteur segmenté ; formes décoratives retirées de l’espace connecté.
  - Bandeau rouge « Dernier jour pour la cotisation » avec bouton « Régler » au lieu du fond de page teinté.
- Nouvelle page « Mon compte » (`/account`), ouverte depuis le bloc compte de la barre latérale : réglages globaux du compte, notifications, puis « Mes clubs » (rôle par club, accès aux paramètres du club pour les admins). La page Paramètres de l’espace famille affiche le même contenu.
- « Paramètres » (nav du club) ne contient plus que les réglages du club et devient réservé aux admins (retiré de la nav coach).
- Moyens de connexion : liaison de Google, d’Apple et ajout d’un mot de passe pour les comptes créés via Google ou Apple.
- Paramètres : refonte de la page.
  - Section Compte ouverte sur une carte profil (avatar, nom, e-mail, « Changer l’avatar ») ; l’e-mail et les moyens de connexion s’affichent en aperçu sur les rubriques repliées.
  - Réglages en lignes plates séparées par un filet, en colonne de lecture.
  - Notifications dans leur propre carte, avec des interrupteurs (sans libellé « Oui / Non ») et les sous-options indentées.
  - Déconnexion et suppression du compte déplacées en liens discrets tout en bas de page ; la suppression passe par une modale de confirmation (case + mot de passe).

### Corrigé

- Photo de profil agrandie : l’image n’est plus coupée par l’en-tête.

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
