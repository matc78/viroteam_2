# Changelog — Portail ViroTeam

Trace des déploiements Firebase App Hosting (tags `portal-v*`).

Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versions alignées sur les tags Git (`portal-vX.Y.Z`).

Avant chaque tag `portal-v*` : déplacer les entrées `[Unreleased]` vers la nouvelle section versionnée.

## [Unreleased]

### Ajouté

- Sparring : section **Sparrings** dans le panneau d’une équipe, sous Joueurs, avec une courte explication ; on y glisse-dépose un joueur (et inversement) ; section **Sparring** de la fiche membre ; badge Sparring gris argent (équipe, convocations, libellé « (sparring) ») ; un sparring part décoché à la création d’un match et reste ajoutable dans « Gérer les convoqués » ; à la liaison FFVB il est exclu d’office des matchs importés
- Panneau d’une équipe : boutons « + » d’ajout (coach, joueur) détourés, sans texte (libellé au survol et pour les lecteurs d’écran)
- Espace club : entrée menu **Équipes** séparée de **Membres** pour admins et coachs (page `/teams`) ; la vue joueur `/team` est inchangée
- Équipes : fond léger des cartes et titre de colonne teintés selon la catégorie — même couleur sur `/teams`, `/team` et `/family/team`, une couleur distincte par catégorie du club
- Paramètres club : rubrique **Lieux de pratique** (ajout, modification, suppression confirmée sur place) avec autocomplétion ville / adresse ; les lieux sont ceux proposés à la création d’un événement, comme dans l’app
- **Présences** (`/attendance`, staff : tout le club ; coach : ses équipes) : réponses des convoqués aux événements passés sur 30 jours, 3 mois ou la saison (depuis le 1er août) — « oui joueurs » (part des convocations avec une réponse oui), « oui équipe » et « ont répondu » (joueurs et coachs), événements analysés, joueurs « à relancer » (sans réponse plus d’une fois sur deux, à partir de 3 convocations) ; tableau par équipe (oui joueurs avec barre, entraînements et matchs joueurs, oui avec coachs, ont répondu) puis détail d’une équipe (joueurs du moins au plus présent, coachs, derniers événements avec joueurs et coachs présents) ; `?team=` ouvre une équipe, bouton « Présences » dans le panneau d’une équipe ; tuile « Taux de oui » (30 jours) sur l’accueil admin et coach, calculée exactement comme la page (joueurs des effectifs seulement, sans les coachs ni les événements « tout le club ») ; une réponse corrigée par le coach compte comme celle du joueur
- **Classements** FFVB : **Mes classements** (`/standings` et `/family/standings`, lien dans la barre latérale si un des clubs du compte fait du volley) — seulement les poules où je joue, coache ou que mon enfant suit, tous clubs confondus, une puce par poule au-dessus du tableau ; onglet **Classements** du club (`/club-standings`, administrateurs d’un club de volley) — toutes les équipes liées du club dans une colonne compacte groupée par catégorie (couleurs de la page Équipes), menu déroulant sur mobile ; meilleur rang en médaille sur chaque puce / ligne, ligne entière du tableau cliquable avec survol, tableau de la poule (podium + 4e, équipes du club mises en avant), prochains matchs et derniers résultats, saison détaillée d’une équipe au clic (forme, bilans domicile / extérieur, scores, salles, parcours) dans un panneau latéral ; lecture directe des documents écrits par la synchro, aucune nouvelle callable
- Pastille de chargement flottante en bas de l’écran pendant une navigation (point orange qui pulse et « Chargement… », puis point vert « Prêt » quand la page a fini de charger ses données) ; n’apparaît pas si la page s’affiche en moins de 200 ms
- Indicateurs « à faire » cliquables jusqu’à l’action : Présences — tuile **À relancer** (ouvre l’équipe concernée sur ses joueurs, ou le tableau des équipes) et badges « N à relancer » ; Équipes — « N à compléter » d’une catégorie (filtre ses équipes incomplètes), puces « Sans coach » / « Aucun joueur » du panneau d’une équipe (ouvrent l’ajout du coach / joueur) ; Cotisations — tuiles **Reste dû** / **À traiter** et puce « aides à valider » (basculent la vue du suivi). `StatTile` et `StatusBadge` acceptent `onClick`
- Équipes (bureau, clubs de volley) : section **Calendrier FFVB** dans le panneau d’une équipe — poule liée, dernière synchro, lien vers le site FFVB ; **Lier le calendrier FFVB** / **Modifier** (dialog en deux étapes comme dans l’app : lien de la poule collé et vérifié, avec capture d’exemple, choix de l’équipe dans la poule, puis « Qui est convoqué ? » — joueurs convoqués par défaut, tous cochés, au moins un — et import silencieux ; la re-liaison reprend le lien et les convoqués mémorisés), **Actualiser** et **Délier** (confirmation sur place, avec option « supprimer aussi les matchs importés ») pour les gestionnaires d’équipes et les coachs de l’équipe, via les callables existantes `previewFederationLink` / `linkTeamFederation` / `refreshTeamFederation` / `unlinkTeamFederation`
- Mon planning (bureau et famille) : bouton discret **Exporter vers mon agenda** qui télécharge un `.ics` des événements à venir des clubs cochés (mêmes identifiants que l’export de l’app : un ré-import met à jour au lieu de dupliquer)

### Corrigé

- Dialogs modaux (`useDialogA11y`) : la page derrière ne défile plus à la molette ou au doigt tant qu’une modale est ouverte (verrou partagé par les modales empilées, barre de défilement compensée) ; la liste des convoqués ne fait plus défiler le dialog une fois arrivée en bout

### Modifié

- Paramètres club : intro des droits coach précisée (« uniquement sur les équipes qu’il entraîne ») ; descriptions des toggles raccourcies
- Paramètres club : droit coach « Prendre les présences » retiré (plus d’appel coach, les présences reposent uniquement sur le RSVP)
- Membres : onglet Équipes retiré (désormais page dédiée) ; les deep links `?team=` pointent vers `/teams`
- Équipes (bureau) : liste dense groupée par catégorie (repliable) au lieu des grandes cartes ; alerte « équipes à compléter » (sans coach / sans joueur) avec filtre dédié ; recherche sans accents qui indique le joueur trouvé ; détail d’une équipe dans un panneau latéral (effectif, ajout / retrait) ; « Inviter l’équipe » passe en action secondaire du panneau ; « Nouvelle équipe » en bouton principal de l’en-tête ; confirmations intégrées au lieu de `window.confirm` ; `?team=` ouvre directement le panneau ; le filtre des joueurs du panneau ignore les accents ; une ligne qui ouvre le panneau est annoncée « développée / réduite » (et non plus comme une bascule)

## [1.14.2] - 2026-11-25

### Corrigé

- Connexion sur téléphone : un glissé à gauche ou à droite passe à la méthode voisine (une seule à la fois) ou revient en place s’il est trop court ; aux extrémités, la carte ne bouge plus. Le défilement natif pouvait sauter une carte, rester entre deux ou changer de vue en plein geste.
- Connexion sur téléphone : les cartes voisines sont raccourcies proprement à la hauteur de la carte affichée (bordure et coins arrondis gardés) au lieu d’être coupées net, et l’ombre des cartes n’est plus rognée en un bloc grisé.

## [1.14.1] - 2026-11-25

### Corrigé

- Connexion sur téléphone : la carte affichée reste centrée après une rotation, un zoom ou un changement de taille du texte (elle restait décalée, à moitié coupée) ; en-tête, onglets, libellé « Mot de passe » et bouton Google adaptés aux très petits écrans.

## [1.14.0] - 2026-11-23

### Ajouté

- Landing : captures de l’espace club refaites sur l’interface actuelle (sidebar, onglets Membres / Équipes, cotisations, planning en vue mois) en 1440×745 ; textes et descriptions alternatives des onglets alignés sur ce qu’elles montrent.
- Inscription : champs Prénom et Nom séparés ; règles du mot de passe affichées en pastilles qui se valident en direct.
- Espace club : page d’authentification unique `/login` en carrousel (Connexion, J’ai un code, Créer un compte). Sur ordinateur, une carte devant et les deux autres en oreilles inclinées qu’un clic fait pivoter, chaque carte gardant sa hauteur, boutons libellés aux couleurs des cartes de part et d’autre, le tout mis à l’échelle pour tenir sans scroll ; sur téléphone, défilement horizontal avec onglets, points et cartes voisines visibles. La carte affichée suit `?vue=` ; `/signup` et `/join` sans code y redirigent.
- Membres : section « Droits » dans la fiche (bascule Administrateur, fonctions prédéfinies, droits à la carte ; Administrateur réservé et protégé) ; badges Admin / Entraîneur / Joueur dérivés, et badge gris « Membre » pour une fiche sans droit admin ni équipe (table Membres avec filtre, fiche, chat, sélecteur de club)
- Planning : dans les réponses d’un événement, badge « Coach » pour les coachs des équipes convoquées ; sur un événement « Tout le club » ou sans équipe, badge « Admin » pour les administrateurs
- Création de club via la callable `createClub`
- Paramètres club (admin) : capacité coach « Publier des annonces pour ses équipes » ; le réglage « Voir les cotisations » devient un droit individuel
- Planning : un admin (ou coach avec le droit `canEditMemberRsvp`) peut modifier le RSVP des convoqués depuis le détail d’événement
- Paramètres club : toggle « Modifier les réponses RSVP » pour les coachs (off par défaut)
- Messagerie (masquée), sondages : un vote enregistre aussi son heure (`pollVoteTimes.{uid}`, horodatage serveur, `edited` si changement), comme l’app — pas encore affichée dans le panneau des votes du portail
- Messagerie (masquée), accessibilité : bouton « Actions du message » au survol et au focus clavier (plus besoin du clic droit) ; suppression confirmée dans le menu d’actions au lieu d’une boîte `window.confirm` ; menus Options et « + » navigables aux flèches (Échap ferme le menu, pas la fenêtre) ; panneaux infos / sondage et fenêtre flottante non modaux (focus à l’ouverture, Échap, Tab peut en sortir pour rejoindre le dock) ; le lecteur d’écran annonce uniquement les messages reçus (« Nouveau message de … »), plus tout le fil ; formulaires sondage, renommage et création avec libellés et erreurs annoncées
- Messagerie (masquée), mobile (< 768 px) : la page Messages affiche la liste ou le fil en plein écran, avec un bouton retour ; points de rupture du chat ramenés à 767 et 1024 px (`ChatBreakpoints`, vérifié par un test)
- Messagerie (masquée) : envoi optimiste (le message apparaît tout de suite en « Envoi… », « Échec · Réessayer » cliquable sinon), bouton flottant « Derniers messages » / « n nouveaux messages », historique chargé automatiquement en remontant (position de lecture conservée)
- Messagerie (masquée) : squelette au chargement du fil, état vide (« Envoie le premier message… » si tu peux écrire), erreur avec « Réessayer »
- Messagerie (masquée) : recherche dans le fil avec compteur « 2 / 5 », navigation précédent / suivant (boutons, Entrée / Maj+Entrée) et résultat courant mis en évidence
- Messagerie (masquée) : modification d’un message directement dans le composer (bandeau « Modification » + Annuler, Entrée enregistre, Échap annule) — la boîte de dialogue de modification est supprimée
- Messagerie (masquée) : mute, favori et réactions appliqués tout de suite, annulés avec un message d’erreur si l’écriture échoue

### Modifié

- Droits purs (à déployer dans la fenêtre de bascule 2.4.0, après la migration `migrate_roles_to_permissions`) : la session lit `members/{uid}.permissions` du club ; toutes les capacités du bureau (navigation, pages, actions) passent par `useBureauCapabilities()` — plus de rôle club comparé ; clubs du compte lus dans `users.memberClubIds`. Garde-fou `lib/auth/permissionUsage.test.ts`
- Rejoindre avec une invitation nominative (compte e-mail / mot de passe) : le lien de confirmation d’e-mail part automatiquement (en français) et l’invitation est acceptée dès que le lien est cliqué (retour sur l’onglet ou vérification toutes les 4 s), sans avoir à cliquer « Envoyer le lien » puis « J’ai confirmé ».
- Mon compte : la page occupe toute la largeur disponible ; en écran large, Compte et Mes clubs à gauche, Notifications à droite (une seule colonne sinon).
- Paramètres du club : même mise en page pleine largeur ; en écran large, Club (fin de saison, logo) à gauche et Droits des coachs (désormais une section à part) à droite.
  - Couleur du club modifiable depuis le portail (couleur unie + 2e couleur facultative), comme dans l’app.
- Barre latérale plus colorée : chaque module a sa pastille d’icône teintée (pleine quand il est actif), lavis bleu et liseré multicolore en tête, badge de chaque club en couleur (Admin, Entraîneur, Joueur, Membre, Parent), avatar initiales en dégradé.
- Planning : la réponse à une convocation s’affiche immédiatement sur le calendrier (bloc plein, contour…) ; l’enregistrement et la resynchronisation se font en arrière-plan, sans voile de rechargement.
  - Samedi et dimanche ne sont plus grisés ; seuls les jours hors du mois affiché le restent en vue Mois.
  - Chaque réponse a son rendu : plein (présent), hachuré (peut-être), atténué et barré (absent), contour (sans réponse).
  - Titre de période homogène (« 26 oct. – 1 nov. 2026 », « Novembre 2026 »), en-tête des jours de la vue Mois intégré à la grille et collé en haut au défilement, flèches de navigation en icônes.
- Refonte visuelle de l’espace connecté (bureau et famille).
  - Navigation en barre latérale : club actif en menu déroulant (avec « Créer un club »), modules avec icônes, Mon planning, Messagerie et compte en bas ; top bar + menu tiroir sur mobile.
  - Barre latérale repliable en icônes seules (préférence mémorisée dans le navigateur).
  - Sur Mon planning, Messagerie et Mon compte, tous les clubs sont listés directement dans la barre latérale.
  - Cotisation dans la nav pour les membres sans droit cotisations (« Ma cotisation ») et les parents (« Cotisations »).
  - Accueil joueur / parent : prochain rendez-vous mis en avant avec la réponse à donner, puis la suite du programme ; cotisation (montant et bouton « Régler ») et annonces en colonne ; compteur de réponses attendues.
  - Accueil club (vue club selon les droits) : bandeau « À traiter » cliquable en tête, 4 chiffres clés, prochains événements avec barre présents / absents, cotisations, annonces et 3 dernières actions.
  - Accueil des équipes entraînées : réponses en attente, semaine à venir, événements de ses équipes avec les réponses, liste de ses équipes.
  - Cotisations (droit « Voir les cotisations ») : l’onglet Suivi s’ouvre par défaut, avec encaissé, reste dû, fiches soldées, actions en attente et l’histogramme des encaissements.
  - Cartes neutres, couleur réservée aux statuts ; boutons RSVP en sélecteur segmenté ; formes décoratives retirées de l’espace connecté.
  - Bandeau rouge « Dernier jour pour la cotisation » avec bouton « Régler » au lieu du fond de page teinté.
- Nouvelle page « Mon compte » (`/account`), ouverte depuis le bloc compte de la barre latérale : réglages globaux du compte, notifications, puis « Mes clubs » (badge par club, accès aux paramètres du club avec le droit correspondant). La page Paramètres de l’espace famille affiche le même contenu.
- « Paramètres » (nav du club) ne contient plus que les réglages du club et n’apparaît qu’avec le droit « Paramètres du club ».
- Moyens de connexion : liaison de Google, d’Apple et ajout d’un mot de passe pour les comptes créés via Google ou Apple.
- Paramètres : refonte de la page.
  - Section Compte ouverte sur une carte profil (avatar, nom, e-mail, « Changer l’avatar ») ; l’e-mail et les moyens de connexion s’affichent en aperçu sur les rubriques repliées.
  - Réglages en lignes plates séparées par un filet, en colonne de lecture.
  - Notifications dans leur propre carte, avec des interrupteurs (sans libellé « Oui / Non ») et les sous-options indentées.
  - Déconnexion et suppression du compte déplacées en liens discrets tout en bas de page ; la suppression passe par une modale de confirmation (case + mot de passe).
- Droits : section **capacités d’équipe** (lecture seule) distincte des **droits club** (raccourcis Responsable… + détail) ; résumé « Entraîneur · N droits club »
- Éditeur de droits : « Voir les cotisations » coché et grisé avec « Gérer les cotisations » ; message clair si le serveur refuse de retirer le dernier administrateur ; textes au tutoiement
- Affichage aligné sur les droits : Stripe Connect réservé à l’administrateur ; licence selon le droit Membres ou la capacité coach ; actions groupées de cotisation pour le Responsable cotisations ; import CSV avec les droits Membres et Équipes (avertissement si une ligne `admin` est importée par un non-admin)
- Accueil composé depuis les capacités (vue club si l’on voit tout le club ou les cotisations, sinon ses équipes entraînées, sinon vue joueur) ; blocs cotisations et journal selon `viewFees` / `viewActivity` — un Responsable membres sans équipe a l’accueil club
- Badges : « Coach » devient « Entraîneur » ; libellés centralisés (`src/lib/copy/badgeCopy.ts`) ; badge Parent dans le sélecteur de club (et l’en-tête) pour un membre sans droit admin ni équipe qui a un enfant lié ; pas de badge « Membre » fugace pendant le chargement de la fiche ; avatar gris pour le badge Membre
- Messagerie : le choix des destinataires n’affiche plus d’identifiant brut (admins lus depuis les fiches liées)
- Vocabulaire : en-têtes et filtre « Badge » (plus « Rôle ») ; `access-denied?reason=no-access` ; descriptions des réglages coach alignées sur l’app
- Invitations : l’aperçu n’affiche plus de « rôle proposé »
- Import CSV : `admin` donne le droit Administrateur ; `coach` rend coach de l’équipe de la ligne, sans droit particulier
- Technique : l’appartenance aux équipes (`members.teamIds`) n’est plus écrite par le portail, seulement par le serveur ; une fiche pré-créée ne porte plus `memberId` ; l’index des clubs passe à `users.memberClubIds`
- Équipes : la puce de ta fiche (ou de l’enfant sélectionné dans l’espace famille) est épinglée en tête du roster et en gras ; le dialog d’ajout à une équipe n’affiche plus le rôle club, seulement l’e-mail
- Membres : bouton « Importer CSV » masqué sur téléphone (≤ 767 px)
- Membres : lecture / écriture Excel via `exceljs` (lazy-load) à la place de SheetJS `xlsx@0.18.5`
- Une seule clé membre (à déployer après la migration `rekey_linked_members`) : la fiche d’un compte est lue à `members/{uid}` via `src/lib/firebase/memberRefs.ts` ; plus de lecture de `member_accounts` ni de résolveurs uid ↔ memberId (rosters, convocations, RSVP, cotisations, contacts, messagerie). La sync des convocations ne fait plus qu’ajouter les joueurs du roster manquants (hors exclus). L’avatar n’écrit plus que `users/{uid}` (fiche membre synchronisée côté serveur). Le suivi des cotisations affiche le nom courant de la fiche. Garde-fou `memberKeyUsage.test.ts`
- Messagerie : visible en local (`NEXT_PUBLIC_CHAT_MESSAGING_LIVE`) ou si `users/{uid}.flags.chatMessaging` ; sinon dock / tuile / panneau Messages masqués (redirect `/messages` → home)
- Messagerie (masquée) : mes bulles en couleur d’accent pleine (texte et liens clairs), celles des autres en surface carte avec la bordure de rôle ; messages consécutifs regroupés comme dans l’app (même expéditeur, même jour, < 5 min, sans séparateur, hors supprimés et sondages) — nom sur le premier, avatar et « queue » sur le dernier, écart `--chat-message-group-gap` (2 px)
- Messagerie (masquée) : photos du fil au gabarit de l’app (220 px de large, hauteur au ratio bornée 120–320 px, place réservée avant chargement, fond de chargement, « Photo indisponible » en cas d’erreur)
- Messagerie (masquée) : avatars aux tailles `--chat-avatar-*` (inbox 44, en-tête du fil 36 — nouvel avatar —, expéditeur 28, votant 22, fiche 88) ; `MemberAvatar` accepte un diamètre libre (`diameter`)
- Messagerie (masquée) : boutons rapides du panneau infos « Couper » / « Réactiver » (libellés accessibles « Couper les notifs » / « Réactiver les notifs ») au lieu de « Mute » / « Notifs »
- Messagerie (masquée) : `ChatThreadView` découpé en hooks et composants (`components/chat/thread/`), logique pure dans `lib/chat/` (`buildThreadRows`, `filterInbox`, `isMessagesPath` unique), tests vitest ajoutés ; rendu inchangé
- Messagerie (masquée) : socle visuel commun avec l’app — tokens `--chat-*` (bulles, citations, avatars, couleurs du fil) dans `globals.css`, couleurs en dur des modules chat remplacées par des variables (thème sombre possible), classes dupliquées factorisées dans `chatShared.module.css`, textes regroupés dans `chatCopy`. Seul changement visible : les bulles vont jusqu’à 78 % de la largeur du fil (85 % avant)

### Corrigé

- Inscription (carrousel) : la redirect post-auth (`from=signup` / club-setup) ne dépend plus de la carte visible ; navigation verrouillée pendant l’auth.
- Accès limité / rejoindre : le footer ne coupe plus le bas de la carte (scroll du contenu).
- Connexion → Créer un compte : le paramètre `next` (ex. `/join?code=…`) est conservé.
- Connexion : un e-mail ou mot de passe incorrect affiche l’erreur sur le formulaire (« E-mail ou mot de passe incorrect. ») au lieu de rediriger vers « Accès limité ».
- Reconnexion : un lien profond (conversation, événement…) garde ses paramètres et rouvre la bonne page après connexion ; `/messages` et `/activity` acceptés ; un parent sans fiche est redirigé vers l’équivalent famille.
- Cotisations famille : en changeant d’enfant ou de club, plus de paiement avec le montant de l’enfant précédent ; fenêtre de paiement non fermable pendant le paiement, puis « Paiement en cours de validation » au lieu d’un second bouton Payer.
- Code d’équipe : un compte connecté confirme avant de rejoindre (bouton « Rejoindre », « Changer de compte », « Pas maintenant ») au lieu d’être inscrit automatiquement.
- `/join` : code introuvable, expiré, épuisé et erreur technique sont distingués (avec « Réessayer »).
- Notifications web : la permission n’est plus demandée sans action ; bouton « Activer » dans les préférences de notifications.
- Messagerie non activée : message explicite au lieu d’une page vide.
- Accueil : l’activité récente ne peut plus afficher celle du club précédent ; le planning se rafraîchit même si l’écoute d’une équipe échoue.
- Photo de profil agrandie : l’image n’est plus coupée par l’en-tête.
- Navigation : « Membres » suit la même règle que l’app — droit Membres ou Équipes, capacité d’inviter, ou coach d’une équipe. Un compte qui a seulement d’autres droits (ex. responsable cotisations ou planning, sans équipe) ne voit plus cette page, qui n’aurait listé que lui ; il garde la vue « Équipe ».
- Membres : un admin ne peut plus modifier son propre rôle (fiche + actions groupées) — seul un autre admin peut le faire ; la callable refuse aussi l’auto-modification
- Membres : un admin en attente (pas encore inscrit) peut à nouveau être supprimé depuis la fiche
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

### Sécurité

- Planning : un coach ne modifie, n’annule ni ne notifie un événement que s’il entraîne toutes ses équipes, jamais « tout le club »
- Garde-fous renforcés : toute comparaison `x.role ===` (hors place en effectif / colonne d’import), `adminIds.includes(`, `Fields.role`, lecture brute `.permissions.includes(` ; écriture d’un miroir `memberId` sur une fiche
- Dépendances : Next.js 15.5.29, `@sentry/nextjs` 10.78 (tunnel `/monitoring`), remplacement de `xlsx` par `exceljs` pour l’import / modèle membres, overrides npm pour les transitives critiques/hautes (`@grpc/grpc-js`, `postcss`, `glob`, `uuid`, `tinypool`) — `npm audit --omit=dev` à 0

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
