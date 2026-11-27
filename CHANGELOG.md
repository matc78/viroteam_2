# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.
Le changelog dédié aux déploiements App Hosting est dans [`portal/CHANGELOG.md`](portal/CHANGELOG.md) (tags `portal-v*`).

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Versioning Sémantique](https://semver.org/lang/fr/).

## [Unreleased]

## [2.5.1] - 2026-11-27

### Ajouté

- Préparation d’entraînement : jusqu’à 6 schémas par exercice (galerie sur la fiche, ajout / suppression), avec lecture de l’ancien champ unique `board`
- Gestion d’équipe : créer un joueur (fiche + invitation) depuis « Ajouter un joueur », puis l’ajouter directement au roster — admin et coach de l’équipe (capacité d’inviter), sans aller-retour par Membres
- Calendrier FFVB : à la liaison, après le choix de l’équipe, une étape « Qui est convoqué ? » liste les joueurs (tous cochés) ; les joueurs décochés ne sont pas convoqués sur les matchs importés ni sur ceux ajoutés par les synchros suivantes (choix mémorisé dans `teams.federation.excludedMemberIds`, repris à la re-liaison), ajustable ensuite match par match depuis le planning ; un match reporté ou modifié par la synchro garde ses convocations
- Classement FFVB : bouton « Actualiser » dans l’AppBar pour les coachs de l’équipe (et gestionnaires d’équipes), même synchro manuelle que depuis la carte équipe
- Classement FFVB multi-équipes / multi-clubs : sous le titre (centré) de l’écran Classement, onglets de club (si plusieurs : pastille et soulignement à la couleur du club, prénoms des enfants suivis pour un parent) puis sélecteur segmenté des équipes du club (si plusieurs, avec un badge de position : or, argent, bronze, chocolat, puis couleur du club) ; ils se partagent la largeur, ou défilent s’ils débordent. Deux équipes d’un club dans la même poule partagent une seule puce, et leurs deux lignes sont mises en avant dans le tableau. Dans le tableau, le rang devient une médaille (rendu métallique, éclat sur le podium) et les 4 premières lignes prennent un fond opaque teinté de leur médaille ; les lignes entrent en cascade (désactivé si animations réduites). La coupe de la home rouvre le dernier classement consulté (mémorisé sur l’appareil, par compte) au lieu de demander « Quel classement ? » ; ordre : club actif puis nom
- Saison d’une équipe (classement FFVB) : en-tête refait — carte héro (médaille de rang, points, forme), stats Bilan / Sets / Points avec jauge pour-contre verte et rouge, répartition des scores en pastilles colorées, bilans Domicile / Extérieur avec icône, salles dans une carte ; cartes du parcours sans adresse (pastille Domicile / Extérieur), liseré et score à la couleur du résultat, sets gagnés en vert et perdus en rouge, heure en pastille pour les matchs à venir

- Gérer les membres : carte de suivi d’activation des comptes (comptes liés sur l’effectif, barre de progression) avec quatre étapes À inviter / Invite en cours / Sans e-mail / Inscrits qui filtrent la liste (re-tap pour tout revoir), mêmes règles que l’onglet Activation du portail
- Gérer les membres : bouton « Importer une liste de membres » qui ouvre une feuille « Importer depuis un ordi » (Ouvrir le site / Copier le lien) vers le portail, où la fenêtre d’import s’ouvre directement (`/members?import=1`) ; feuille réutilisable `showPortalHandoffSheet` pour d’autres actions pensées pour l’ordinateur
- Sparring : un joueur peut passer « sparring » dans une équipe (bouton sur sa ligne dans Gestion des équipes, ou section Sparring de sa fiche membre) — admin et coach avec gestion d’effectif ; il s’entraîne avec l’équipe mais n’est pas convoqué d’office aux matchs (création de match, import FFVB), on peut l’ajouter match par match via « Gérer les convocations » ; ses matchs à venir le retirent sauf s’il a déjà répondu présent, et il y revient quand il repasse joueur. Nouveau badge Sparring gris argent dans l’effectif, les convocations et le libellé d’équipe de la fiche (`teams.sparringIds`, règles et trigger `onTeamWritten`)
- Équipes (Gestion) : liste groupée par catégorie, en-têtes repliables avec le nombre d’équipes et les alertes « sans coach » / « sans joueur » ; une couleur par catégorie (pastille sur les cartes de Gestion et de Mes équipes), la même que sur le portail
- Préparation d’entraînement : **Bibliothèque** (bouton sous les exercices de ma préparation) — séances passées préparées sur mes équipes depuis 6 mois, les miennes et celles des collègues, onglets Séances / Exercices avec recherche sans accents ; « Dupliquer dans cette séance » copie tous les exercices (et les notes si les miennes sont vides), « Ajouter à la séance » copie un exercice (doublons regroupés), « Consulter » ouvre la séance passée ; mêmes règles et mêmes documents que la bibliothèque de la page Séances du portail, copies écrites en un seul lot
- Préparation d’entraînement : « Copier dans ma préparation » sur la préparation d’un collègue (exercices à la suite des miens, sans ses notes) ; les collègues qui n’ont rien préparé ne sont plus proposés
- **Présences** (vue club, zone de gestion, et pastille « % de oui » de l’en-tête du club) pour l’encadrement (droit membres, équipes ou planning : tout le club ; coach : ses équipes) — réponses des convoqués aux événements passés sur 30 jours, 3 mois ou la saison : Oui joueurs, Oui équipe (avec les coachs), Ont répondu, Événements, À relancer (filtre les équipes concernées) ; une ligne par équipe (oui joueurs avec barre, entraînements / matchs, réponses, « N à relancer ») puis le détail d’une équipe (joueurs du moins au plus présent avec « Répond peu », coachs, 12 derniers événements) ; mêmes calculs que la page Présences du portail (joueurs des effectifs, sans les événements « tout le club » ni annulés, une réponse corrigée par le coach compte)
- Fiche membre : section **Présences de la saison**, visible par tous — pour chaque équipe où le membre est joueur (sparring compris) ou coach : rôle dans l’équipe, % de oui avec barre, nombre de convocations, oui aux entraînements et aux matchs **passés** depuis le 1er août ; un joueur qui ouvre la fiche de son coach y voit donc aussi ses présences d’entraîneur ; un parent ne voit que les équipes de ses enfants ; message explicite s’il n’y a pas encore de convocation passée (les RSVP sur un événement à venir ne comptent pas)

### Modifié

- Lecture d’événement : un `rsvpUpdatedAt` / `seenAt` / `rsvp` legacy mal typé (ex. `Timestamp` à la place d’une map) n’empêche plus le chargement des présences de saison sur la fiche membre
- Détail d’événement : actions staff (Notifier, Préparer / Ma préparation, Modifier, Convoqués) en grille 2 colonnes compacte au lieu d’une pile pleine largeur
- Préparation d’entraînement disponible en release pour les coachs (jusqu’ici réservée au debug) : flag `FeatureFlags.trainingPrepLive`

- Schéma d’exercice : le jeton ballon affiche l’icône volleyball (plus le rond jaune) ; fond « Tableau blanc » sans marquage de terrain (en plus de terrain entier / demi-terrain)
- Schéma d’exercice : comme sur le portail, jetons et flèches se déplacent avec tous les outils, une extrémité de flèche se déplace seule, une flèche touchée se sélectionne (poignées, bouton « Supprimer la flèche ») ; double tap sur un joueur ou un adversaire pour changer son numéro
- Paramètres club : intro des capacités coach précisée (« uniquement sur les équipes qu’il entraîne ») ; descriptions des toggles raccourcies

### Supprimé

- Appel coach (pointage Présent / Absent pendant ou après la séance) : feuille « Faire l’appel », flag `FeatureFlags.attendanceTracking`, capacité coach `canTakeAttendance` (catalogue, Functions, portail, règles) et pastille « % présents (appel) » de l’écran club ; les présences reposent uniquement sur le RSVP (une réponse corrigée par le coach compte) ; les règles refusent désormais toute écriture de `events.attendance` par un coach
- Retours de séance (notes collectives, messages perso, page Feedback, bouton d’accueil) masqués partout, debug compris : flag `FeatureFlags.trainingFeedbackLive` coupé, routes redirigées vers l’accueil ; code app et callable `sendTrainingFeedback` conservés volontairement (dormants)

## [2.5.0] - 2026-11-25

### Ajouté

- Calendrier et classement FFVB (volley) : dans l’onglet « Gérer » d’une équipe, le coach ou un gestionnaire d’équipes colle le lien de la page calendrier de sa poule (ffvbbeach.org), choisit son équipe, et toute la saison arrive dans le planning sans notification (domicile / extérieur, adversaire, salle, score). Synchro automatique tous les 2 jours à 5h (plus bouton « Actualiser ») : un report, un changement de salle ou de domicile / extérieur notifie l’équipe via les push existants ; le score s’affiche sans notification. Spec [`docs/specs/viroteam_v2_federation_sync_spec.md`](docs/specs/viroteam_v2_federation_sync_spec.md)
- Classement de la poule pour les joueurs, coachs et parents de l’équipe (coupe dans l’en-tête de la home, bouton dans « Mes équipes ») ; un tap sur une équipe ouvre sa saison : rang, forme, bilans (sets, points, 3-0…0-3, domicile / extérieur), salles où elle reçoit et parcours match par match
- Functions : callables `previewFederationLink`, `linkTeamFederation`, `unlinkTeamFederation`, `refreshTeamFederation` et tâche planifiée `syncFederationTeams` (lecture de la page HTML et de l’export CSV FFVB) ; règles : champ `teams.federation` et sous-collection `teams/{id}/federation` réservés aux Functions ; index collection group `teams.federation.provider`
- Outils d’entraînement des coachs (flag `FeatureFlags.trainingToolsLive` : debug seulement pour l’instant). Préparation : bouton « Préparer l’entraînement » sur un entraînement à venir (accueil et planning), une partie par coach (notes libres + exercices réordonnables avec titre, durée, consignes et schéma sur tableau blanc terrain de volley : crayon, flèche, joueurs, adversaires, ballon) ; les collègues lisent, l’admin consulte. Retours : compteur des séances des 15 derniers jours sans retour (expliqué en tête de la partie Gestion) et liste des entraînements passés ; deux notes collectives (niveau de jeu, envie / participation) et un mot au collectif visibles de toute l’équipe et des parents, message perso facultatif par joueur visible du joueur et de ses parents (pas de note individuelle), brouillon enregistré tout seul, push à l’envoi ; « Consulter les retours » en lecture seule pour les coachs et les admins. Plusieurs coachs : un retour par coach, le joueur reçoit les notes et le mot de chacun ; dans « Feedback entraînement », les retours envoyés par les collègues apparaissent en tuile sous la séance concernée. Appui long sur une séance « À faire » : badge « Flemme », la séance sort du compteur de l’accueil (re-appui long pour annuler). Page « Feedback » (icône à côté de la coupe dans l’en-tête de l’accueil : pastille bleue à gauche = retours à faire, rouge à droite = retours de coach non lus ; plus de tuile sur l’accueil) : partie « Gestion » pour les coachs et admins (séances à faire, retours des collègues, autres équipes du club en consultation pour l’admin) et partie « Pour moi » (retours reçus, moi ou mes enfants, du plus récent au plus ancien, « Nouveau » tant que pas lu) ; sélecteur Gestion / Pour moi quand les deux existent. Ouvrir un retour le marque lu ; bouton « Revoir le retour du coach » dans la fiche de l’entraînement passé ; état perso dans `users/{uid}/trainingFeedbackState` (privé au compte)
- Functions : callable `sendTrainingFeedback` (retour d’un coach + push au joueur et aux parents, une fois) ; règles des sous-collections `trainingPlans`, `trainingFeedbackDrafts`, `trainingFeedback` (+ `playerMessages`) sous un événement et champ `events.trainingFeedbackSentBy` réservé aux Functions ; re-clé des messages perso, brouillons et états « lu » d’une fiche pré-inscrite ; index `events (teamIds, type, date desc)` et collection group `playerMessages (clubId, memberId)`

### Modifié

- Cartes d’équipe (« Mes équipes » et « Gérer ») repensées : en-tête avec avatar, catégorie et effectif toujours visibles (pastille FFVB si liée), actions rapides en pastilles (chat équipe, chat parents, inviter, classement), bloc FFVB compact (tap = classement, menu ⋮ Actualiser / Délier) et effectif en lignes légères avec compteur par section au lieu de cartes imbriquées
- Calendrier FFVB : bloc de liaison proposé aux clubs de volley seulement ; la feuille de liaison montre une capture d’exemple de la page calendrier attendue (vignette, agrandissable d’un tap) ; « Délier » propose de supprimer aussi les matchs importés par ce lien (erreur de poule ou d’équipe), sans notification et sans toucher aux matchs saisis à la main
- Classement FFVB : parcours du plus récent au plus ancien ; en-tête et tuiles de match centrés ; adresses de salle enrichies via la fiche match PDF (ex. `PERDREAU, 1 BIS RUE PERDREAU, 78390 BOIS D'ARCY`) pour Google Maps
- Migration rôles → droits (`tool/migrate_roles_to_permissions.mjs`) : un club sans membre actif est supprimé, ainsi que les clubs de test listés (5 en prod) ; un club sans admin lié voit son premier membre arrivé (lié à un compte de préférence) promu admin ; un ancien coach sans équipe passe membre (aucun droit, l’admin lui réattribue des droits)
- Invitation nominative avec un compte e-mail / mot de passe : le lien de confirmation d’e-mail part tout seul (en français) dès que l’acceptation le demande, et l’invitation est acceptée automatiquement une fois le lien cliqué (retour dans l’app ou vérification toutes les 4 s) — plus besoin de « C’est fait » ni de retaper Accepter

### Corrigé

- Créer une équipe depuis « Mes équipes » (état vide admin) bascule vers l’onglet Gestion pour ajouter coachs et joueurs, au lieu de rester sur une liste encore vide
- Accepter une invitation nominative sans e-mail confirmé affichait seulement « Confirme ton adresse e-mail… » sans jamais proposer d’envoyer le lien (erreur enveloppée par `InvitationService`) : le joueur attendait un mail qui n’était jamais parti

## [2.4.0] - 2026-11-17

### Ajouté

- Droits des membres (« droits purs », mise à jour obligatoire 2.4.0) : un admin confie des droits précis sans faire de quelqu’un un coach ou un admin — fonctions prédéfinies (Responsable cotisations, annonces, membres, sportif, matériel) et réglage droit par droit dans la nouvelle feuille « Droits » d’une fiche, avec une bascule Administrateur (plus de modèles Entraîneur / Joueur : être coach ou joueur, c’est figurer dans une équipe). Droit Administrateur protégé (seul à attribuer des droits, toujours au moins un par club). Spec [`docs/specs/viroteam_v2_permissions_spec.md`](docs/specs/viroteam_v2_permissions_spec.md)
- Coachs : nouvelle capacité « Publier des annonces pour ses équipes » dans les réglages coach du club
- Functions : callables `setMemberPermissions` (remplace `setMemberRole`) et `createClub` (création de club côté serveur) ; script de migration `tool/migrate_roles_to_permissions.mjs` (dry-run par défaut, `--apply`, `--drop-legacy`)

- Analytics : événements `notification_opened` (tap push par type) et `club_action_tapped` (CTA fiche club + rôle) ; super-propriété app `active_role` ; tableau de bord PostHog **Usage** (events, RSVP, taux proxy, notifs, vue club, top écrans)
- Coûts : fiche [`docs/COUTS.md`](docs/COUTS.md) (inventaire Firebase/GCP, PostHog, Sentry, Brevo, GitHub, stores ; alertes vs saisie) + modèle mensuel [`docs/couts_mensuel.csv`](docs/couts_mensuel.csv)
- Retour haptique (app) : petite vibration au RSVP, à l’envoi d’un message, au changement de sélecteur (Jour / Semaine / Mois, Moi / enfant, Membres / Parents, appel, thème, moment du bilan coach), au seuil du swipe vers la messagerie et du pull-to-refresh, à l’appui long (dont le menu d’un message), et sur les toasts succès / erreur (double impulsion si un RSVP échoue, y compris saisi par le staff). Réglage « Vibrations » dans Paramètres > Apparence (activé par défaut). Point d’entrée unique `ViroHaptics`

### Modifié

- Droits : feuille d’attribution séparée en **capacités d’équipe** (lecture seule : équipes entraînées + flags `coachPermissions` du club) et **droits club** (admin, raccourcis Responsable…, détail) ; résumé fiche « Entraîneur · N droits club »
- Rôles → droits : `members.role` n’autorise plus rien (supprimé après la bascule) ; seule `members.permissions` fait foi, écrite par les Functions. Coach d’équipe = relation (`teams.coachIds` → `members.coachTeamIds`, trigger) avec les capacités `clubs.coachPermissions` sur ses seules équipes. Badges Admin / Entraîneur / Joueur dérivés, et **Membre** (gris) pour une fiche sans droit admin ni équipe ; Admin s’affiche sur la fiche, dans la vue Membres et dans les réponses d’un événement spécial (tout le club ou sans équipe), jamais dans la vue équipe ni dans les réponses d’un événement d’équipe. `adminIds` devient un simple index d’audience. Point d’entrée unique par couche (`ClubAccess`, `permissions.ts`, `useBureauCapabilities`, `can()` dans les règles) + garde-fous `permissionUsage`
- **Changement de comportement** : un coach ne publie plus d’annonce pour tout le club ou une catégorie (droit Annonces), seulement pour ses équipes ; il ne voit plus les cotisations du club sans le droit « Voir les cotisations » (remplace le réglage coach `canViewFees`) ; un coach sans équipe ne crée plus d’événement
- Analytics : super-propriété `active_role` = badge principal ; `max_role` retiré
- Équipes : dans l’effectif, ta fiche (ou celle de l’enfant sélectionné via Moi / enfant) est épinglée en tête de sa section et son nom passe en gras ; le badge affiche le rôle dans l’équipe (Coach / Joueur) au lieu du rôle club
- Modèle de données : une fiche ne porte plus `userId` ni `memberId` (`accountUid` seul lien au compte) ; ses équipes (`teamIds`) sont maintenues par le trigger d’équipe, plus par les clients ; `users.memberClubIds` devient le seul index des clubs d’un compte, écrit par les Functions (`clubMemberships` et le trigger `onUserWrittenSyncClubIds` retirés). Migration : `tool/migrate_roles_to_permissions.mjs` (recopie `accountUid`, `--drop-legacy` efface les anciens champs et `join_requests`)
- Accueil : la barre clubs / + / messagerie remonte via `viewPadding` (barre 3 boutons Android) avec une petite marge seulement quand cet inset est présent — inchangé sans barre système
- Sélection (app) : fini les cases à cocher carrées. Les listes à cocher (convocation d’un match, destinataires d’une conversation, sélection multiple des cotisations et des membres) passent à une coche ronde animée, la ligne choisie se teinte sans changer de hauteur et reprend sa forme au second tap. La feuille « Droits » d’une fiche passe en cartes avec des icônes dessinées pour ViroTeam, fonctions en grille de raccourcis. Toucher une capacité d’équipe (en admin) propose d’aller la régler dans les paramètres du club
- Paramètres du club : cocher ou décocher une capacité coach ne ramène plus en haut de la page (`ViroScaffold` garde le même arbre avec ou sans `fallbackRoute`) ; fiche membre : plus de voile gris sous les lignes Licence, Parent et Gérer les droits
- Pointage des présences masqué (flag `FeatureFlags.attendanceTracking`) : plus de bouton « Faire l’appel » ni de capacité coach « Prendre les présences » dans l’app, en attendant de retravailler la fonctionnalité ; données et code conservés
- Loader : animation d’assemblage du logo ViroTeam (cycle ~1,4 s) à la place du spinner circulaire pour tous les chargements plein contenu
- Notifications push : voix vestiaire pour les joueurs (titres en rotation — relance manuelle, convoc’, J-7 / J-2 / jour J), plus familier pour le staff (bilan, RSVP) ; parents adoucis ; cotisation / annonces / annulation inchangés. Relance manuelle réservée aux sans-réponse et « peut-être », signature « Signé coach {prénom} »
- Accueil membre : tous les événements des 14 prochains jours s’affichent directement ; le bouton « Voir mes 14 prochains jours » (aperçu limité) est retiré
- Notifications RSVP : liseré des events plus visible (trait plus épais, halo, clignotement plus contrasté) et voile coloré sur la tuile (vert / orange / rouge selon la réponse) ; petite flèche haut / bas pendant les 10 s si un event encadré est hors écran (tap pour y défiler) — pastille bleue / flèche blanche en clair, pastille claire / flèche bleue + halo en sombre
- Vue club : l’encadré « Mon parent » ne s’affiche plus que pour les joueurs d’au moins une équipe en catégorie moins de 15 ans (U15 / M15 / -15 et équivalents par sport) ; masqué s’il n’y a aucune équipe
- E-mails d’invitation : une fiche « Membre » (ni admin ni équipe) reçoit une invitation et une confirmation « membre », plus « joueur »
- Droits, affichages : « Gérer les membres » et « Mon parent » suivent les bons droits ; un seul badge sur la fiche ; un droit inclus par un autre est coché et grisé ; réglages coach du club suivis en temps réel

### Supprimé

- Demandes de rôle : écran « Demander un rôle », liste des demandes côté admin, « Rôle proposé » sur l’aperçu d’invitation, callable `resolveJoinRequest` et collection `join_requests`

### Corrigé

- Ajout d’un membre refusé par les règles pendant la refonte des droits (la fiche pré-créée portait encore `memberId`)
- Messagerie : un membre avec le droit « Messagerie » mais pas admin ne voyait pas le canal qu’il venait de créer
- Coach d’équipe : `coachTeamIds` recalculé depuis l’équipe courante (des déclenchements traités dans le désordre pouvaient laisser une relation coach périmée)
- Invitations : un coach autorisé peut de nouveau envoyer l’e-mail d’invitation d’un joueur de ses équipes (`sendMemberInvites` exigeait le droit Membres)
- Arrivée par code d’équipe : une fiche déjà à l’uid du compte est bien liée (`accountUid`, index `adminIds`) — elle échappait sinon à l’anonymisation à la suppression du compte
- Règles : le droit « Gérer les cotisations » implique la lecture des cotisations même sur une fiche non normalisée
- Re-keying d’une fiche : les champs v1 `role` / `coachInfo` ne sont plus recopiés
- Functions : index `adminIds` calculé en un seul endroit, helpers dédoublonnés, code mort retiré
- Invitations (app) : un lien `/join?code=` ouvert app fermée n’est plus perdu pendant le chargement ; un invité qui relance l’app avant d’accepter n’est plus bloqué dans la création de club (intention d’inscription mémorisée) ; un compte qui a déjà des clubs retrouve l’invitation en attente après connexion
- RSVP (app) : depuis l’accueil ou le planning perso, la feuille d’un événement répond pour toi, plus pour l’enfant sélectionné ; une push RSVP pour un enfant ouvre bien sa vue ; répondre pour un enfant ne masque plus l’événement dans ta vue « Moi »
- Déconnexion (app) : le token de notifications est toujours désinscrit, et le club actif comme la sélection Moi / enfant repartent à zéro (plus de rattachement analytics au club du compte précédent)
- Navigation (app) : plus d’erreur au retour sur un écran ouvert par redirection ou lien (connexion, inscription, réglages du club…) ; plus de repli bref sur la fiche du parent pendant le chargement des cibles
- Paiements : un paiement CB arrivé après la liaison du compte de l’enfant est crédité sur la bonne fiche (via `formerMemberIds`), sinon remboursé ; l’excédent d’un paiement partiellement crédité est remboursé ; un seul PaymentIntent par cotisation à la fois
- Liaison d’une fiche : en cas d’échec de la réécriture des références (rosters, événements, cotisations), relances puis reprise automatique planifiée (`scheduleMemberRekeyResume`) au lieu d’un joueur fantôme ; mises à jour par transaction document par document
- Suppression de compte : une relance ne décrémente plus deux fois le nombre de membres du club
- Codes d’invitation tirés avec un générateur cryptographique et vérifiés uniques ; plafond des invitations parent respecté même en appels simultanés
- HelloAsso (code dormant) : un paiement en plusieurs fois ne crédite plus le total dès la 1ʳᵉ échéance ; montant du checkout borné au reste dû

### Sécurité

- Règles Firestore réécrites sur les droits : un admin ne peut plus écrire un rôle ou des droits en direct (callable seulement), `users.clubMemberships` / `memberClubIds` ne sont pas modifiables par leur titulaire, aucun client n’écrit `teamIds`, `coachTeamIds`, `accountUid` ni `permissions` d’une fiche (même à sa création), `member_accounts` et `join_requests` refusés, les cotisations ne sont plus lisibles par tout coach, les capacités coach (`canCreateEvents`, `canTakeAttendance`, annonces…) sont appliquées côté serveur et limitées aux équipes du coach, création de club uniquement via `createClub` ; scénarios rejoués dans `rules-tests/`
- Coachs : plus de modification, d’annulation ni de notification d’un événement « tout le club » ou d’un événement multi-équipes dont ils n’entraînent pas toutes les équipes
- Coachs : invitations et fiches pré-inscrites limitées à leurs équipes et aux fiches sans droit (un coach ne peut plus détourner l’invitation d’un futur admin) ; modération limitée aux conversations de leurs équipes
- Règles : champs de re-clé / anonymisation réservés aux Functions ; une fiche pré-créée ne prend plus l’id d’un compte existant
- Code d’équipe : il ne permet plus de récupérer la fiche d’un autre membre (et ses droits). Seules les fiches de l’équipe, sans droit ni relation coach, sont liables, et uniquement par e-mail vérifié (plus de rapprochement par prénom + nom)
- Invitations : seul un admin peut inviter (ou rediriger l’invitation d’)une fiche pré-inscrite qui porte des droits ou une relation coach ; un coach ne peut plus détourner la fiche d’un coach d’une autre équipe ; `code` au format attendu et `expiresAt` obligatoire et borné
- Événements multi-équipes : un coach d’une partie des équipes ne peut plus vider l’audience ni effacer les réponses des joueurs des autres équipes ; `setEventRsvp` vérifie que la fiche visée est convoquée et, pour un coach, dans ses équipes, et refuse un événement annulé
- RSVP direct limité aux événements où l’on est convoqué, valeurs `yes` / `maybe` / `no` / `none` seulement
- Messagerie : un message supprimé est purgé côté serveur (texte, image et miniature dans Storage, citations) par le trigger `onChatMessageUpdatedPurgeDeleted` ; aperçu de conversation et badge de l’expéditeur non falsifiables ; une citation doit pointer vers le vrai auteur
- Règles : `memberCount` seulement +1 côté client, saisons de cotisation non supprimables côté client, verrou de checkout réservé aux Functions ; avatars SVG refusés dans Storage

## [2.3.0] - 2026-11-06

### Sécurité

- Cloud Functions : `npm audit fix` (proxy-addr, busboy, body-parser, grpc, qs) + override `uuid` ≥ 11.1.1 — `npm audit` à 0 faille
- Portail : bumps Next 15.5.29, Sentry 10.78, remplacement de `xlsx` (sans patch npm) par `exceljs`, overrides ciblés (`@grpc/grpc-js`, `postcss`, `glob`, `uuid`, `tinypool`) — graphe prod à 0 faille

### Ajouté

- Notifications RSVP : un tap ouvre la home et encadre d’un liseré clignotant les events concernés, couleur de la dernière réponse (vert présent, orange peut-être, rouge absent), pendant 10 s ou jusqu’au changement de page. Si aucun de ces events n’est sur la home (coach hors convocation, event au-delà de 14 jours), on retombe sur le planning comme avant. Cloud Functions : les liens planning des push RSVP (staff, parent, digest coéquipiers) portent `rsvpClubId` + `rsvpHighlights` ; les anciennes versions de l’app les ignorent
- Messagerie (masquée), sondages : l’heure de chaque vote est enregistrée (`pollVoteTimes`, horodatage serveur, app + portail) et affichée dans le détail des votes (« Voté à 14:43 », « Modifié le 4/11 à 09:12 » si le membre a changé d’avis). Rules Firestore : un membre n’écrit que sa propre heure ; les anciens clients qui votent sans heure restent acceptés

### Modifié

- Messagerie (masquée), app : le détail d’un sondage s’ouvre en bottom sheet glissable au lieu d’une nouvelle page (route `/conversations/…/polls/…` retirée)
- Messagerie (masquée), app : menu « + » plus lisible — voile flouté sur le fil, pastilles et libellés agrandis
- Messagerie (masquée), app : nouvelles bulles — en clair, les miennes en bleu marque opaque (texte foncé) et celles des autres en blanc, sans contour ; en sombre, fond noir et texte blanc, contour couleur du club (blanc si elle est quasi noire) et, pour les miennes, contour néon de la couleur opposée au club (bleu néon si le club est noir / gris)
- Home : fond flouté sous la barre du bas (clubs, ajout de club, messagerie) pour que les boutons restent lisibles au-dessus du contenu
- Messagerie (masquée), app : look plus proche de WhatsApp / Snap — bouton d’envoi en pastille pleine bleue (adoucie tant que le champ est vide) calée en bas à droite du champ ; en-tête avec le nom du groupe en entier et le nombre de participants, tap sur l’en-tête pour ouvrir les infos (le bouton ⓘ part dans le menu) ; aperçu du dernier message sur deux lignes fixes, plus contrasté

### Corrigé

- Membres : une seule clé par personne — à la liaison d’un compte (invitation, code d’équipe), la fiche pré-inscrite passe sous `members/{uid}` avec toutes ses références (rosters, tous les events en écriture silencieuse, guardians et `parentLinks`, cotisations et paiements, annonces, invitations, `adminIds`). Un code d’équipe ne crée plus de fiche à id aléatoire. Migration de l’existant : `tool/rekey_linked_members.mjs` (dry-run par défaut ; complète aussi `accountUid` sur les fiches liées par le seul `userId` legacy et supprime l’index `member_accounts`)
- Membres : nettoyage de la double clé — index `member_accounts` et résolveurs uid ↔ memberId supprimés dans l’app, le portail, les Cloud Functions et les rules (ma fiche = `members/{monUid}`, RSVP sous une seule clé) ; les push ne visent plus jamais un id de fiche non liée pris pour un uid (coachs et joueurs passent par `accountUid`) ; cotisations affichées au nom actuel du membre. Ordre de déploiement : migration des données, puis Functions / rules / portail, puis relance du script, puis app 2.3.0 forcée
- Membres : changer son nom ou sa photo dans les paramètres met à jour sa fiche dans tous ses clubs, même pré-inscrite (trigger serveur `onUserWrittenSyncMemberProfile`, au lieu d’une écriture client qui ratait les fiches dont l’id n’était pas l’uid)
- Membres : un admin ne peut plus modifier son propre rôle (app + callable) — seul un autre admin peut le faire descendre
- Membres : un admin en attente (pas encore inscrit) peut à nouveau être supprimé depuis la liste / la fiche
- Rules Firestore : un coach / admin ne peut plus patcher le `rsvp` d’un autre membre côté client ; l’édition staff passe uniquement par la callable
- Messagerie (masquée), app : le clavier se ferme en glissant vers le bas ou en touchant le fil, même quand la conversation tient sur un écran (avant, il fallait quitter la page)

## [2.2.14] - 2026-11-05

### Ajouté

- Notifications : digest multi-événements pour l’opt-in « Réponses des coéquipiers » (fenêtre 2 min) — une seule push du type « Marie a répondu à 3 convocations, vérifie dans l’app » au lieu d’une notif par event
- Notifications : copy dédiée quand quelqu’un passe de présent à absent / peut-être (« Marie D. a changé » · « Présence : ne vient plus »)
- Planning : un admin (ou un coach avec le nouveau droit `canEditMemberRsvp`, off par défaut) peut modifier le RSVP d’un joueur ou coach convoqué, via la callable `setEventRsvp` (app + portail)
- Messagerie (masquée), accessibilité : sur une bulle, VoiceOver / TalkBack proposent « Répondre », « Réagir avec un cœur » et « Plus d’actions » (plus besoin du double-tap ou de l’appui long) ; emojis, réactions, avatar de l’en-tête et menu ⋮ annoncent un nom ; « + », emojis, « Réessayer » et réactions ont une zone de tap d’au moins 44. Parcours de recette avant ouverture : `docs/CHAT_SMOKE.md`
- Messagerie (masquée) : chaque conversation porte les profils de ses participants (`participantProfiles` : nom, rôle, photo), écrits uniquement par les Functions à chaque sync et mis à jour quand un membre ou un parent change de nom ou de photo (`onMemberWrittenForChat`, nouveau trigger `onUserWrittenForChat`). Un parent voit enfin les noms, photos et rôles des expéditeurs dans le fil, et le portail n’a plus besoin de relire les membres un par un

### Modifié

- Portail Membres : l’import CSV / Excel est masqué sur viewport ≤ 767 px (peu pratique au téléphone) ; export et ajout unitaire inchangés
- Prefs notifs : si `rsvp` est absent en base, l’app et le portail héritent de `events` (aligné Functions) — évite un écart UI / envoi pour les anciens profils
- Messagerie : visible en debug ; en release / prod seulement si `users/{uid}.flags.chatMessaging == true` (console, pas d’auto-grant client). Portail : même règle via le profil (env local `NEXT_PUBLIC_CHAT_MESSAGING_LIVE` inchangé). Push Functions : destinataires taggés tant que `CHAT_MESSAGING_LIVE=false`
- Messagerie (masquée), fil : mes messages en bulles bleues, messages consécutifs d’une même personne regroupés (nom et avatar une seule fois), squelette au chargement et « Réessayer » en cas d’erreur, photos à leur ratio avec placeholder et progression pendant l’envoi, modification d’un message directement dans le champ (plus de boîte de dialogue), bouton d’envoi grisé tant que le champ est vide, recherche avec compteur (« 2 / 5 ») et navigation précédent / suivant
- Messagerie (masquée), inbox et création : état « aucun résultat » distinct de l’inbox vide, placeholder de recherche fidèle à ce qu’elle filtre, fenêtres « nouvelle conversation » et « sondage » alignées sur les autres sheets ; les destinataires possibles sont chargés par `ChatDmTargetsService` avec des lectures groupées (plus de lecture par destinataire)
- Messagerie (masquée) : tokens communs avec le portail (`ViroChat` ↔ `--chat-*`), un seul avatar de conversation (`ViroConversationAvatar`) pour l’inbox, l’en-tête du fil et la fiche, bulles de sondage alignées sur les messages (78 % de large, mêmes marges). « Vous » devient « Toi » et les états vides de l’inbox et du fil affichent une ligne d’aide
- Messagerie (masquée), sans changement visuel : l’état du fil (historique, envois optimistes et relance, non-lus) passe dans un contrôleur Riverpod par conversation (`chatThreadControllerProvider`) et les trois chemins d’envoi (texte, photo, relance) dans `ChatService.sendPendingMessage`. Le détail des votes d’un sondage devient une route go_router (`/conversations/:clubId/:conversationId/polls/:messageId`) avec retour vers le fil. Nouvelles tuiles `ChatReactorListTile`, `ChatDmTargetListTile`, `ChatMediaListTile` et premiers tests du chat (helpers du fil, tri de l’inbox, extraction des médias, tuiles)

### Corrigé

- RSVP double clé (memberId + accountUid) : l’app affiche le vote le plus récent (`rsvpUpdatedAt`) au lieu de la première clé trouvée ; le trigger events réécrit sous l’accountUid tout vote posé sous le memberId par une ancienne app (≤ 2.2.13), sans push en double
- Notifications : une écriture technique (script `tool/`, normalisation serveur) qui pose `silentWriteAt` ne déclenche plus aucune push ; `repair_event_rsvp_audience.mjs` le pose
- Messagerie (masquée) : les pastilles de réaction sous une bulle ne réagissaient au tap que sur leurs quelques pixels du haut
- Messagerie (masquée) : une conversation de l’inbox s’ouvre au tap n’importe où sur la tuile (les zones vides, à droite du titre par exemple, ne réagissaient pas — corrigé dans `ViroPressable`, donc pour toutes les tuiles qui l’utilisent)
- Messagerie (masquée) : un message avec beaucoup de réactions différentes n’affiche plus qu’une rangée de 4 emojis (les plus utilisés) puis « +n », et cette rangée déborde vers le centre du fil au lieu de sortir de l’écran
- Avatars à initiales (`MemberAvatar`) : fond opaque, le motif du fil de discussion ne transparaît plus
- RSVP : les joueurs avec fiche pré-créée (invitation) pouvaient voir leur présence « coincée » — l’app écrivait sous `memberId` alors que les convocations / l’UI lisaient `accountUid`. Lecture, écriture, rules et création d’événement utilisent maintenant le même canon (`accountUid` si lié) ; un vote nettoie l’ancienne clé, et un script `tool/repair_event_rsvp_audience.mjs` répare les doubles clés déjà en base
- Messagerie (masquée) : l’app n’empêche plus d’envoyer un message tant que le précédent n’est pas confirmé, les anciens messages ne disparaissent plus du haut du fil quand un nouveau arrive, et « Charger plus » ne s’affiche que s’il reste de l’historique
- Messagerie (masquée) : les canaux réservés aux coachs et admins affichent le bon bandeau (« Seuls les coachs et les admins peuvent écrire ici. ») dans l’app et sur le portail
- Tests des règles Firestore : `npm test` fonctionne aussi sous Windows (guillemets du script)
- Release Android CI : épingle Temurin JDK 21 dans `release-android.yml` (le runner `ubuntu-latest` passait sur Java 25 et faisait échouer `assembleRelease` avec le seul message « 25.0.x »)

## [2.2.13] - 2026-11-02

### Ajouté

- Planning : un coach / admin peut modifier un événement (détail > « Modifier l’événement ») : date, heures (début / fin, ou heure du match et de RDV), lieu, lieu de RDV, et titre pour une réunion ou un « autre ». Une seule occurrence est modifiée, même dans une série. Seuls les champs changés sont écrits : le trigger existant prévient les convoqués (« reporté » si la date ou l’heure de début bougent, sinon « modifié »). Avant, il fallait annuler puis recréer
- Analytics : tableau de bord PostHog « Portail » (portail web seul) dans `tool/posthog_dashboards.mjs`, et option `--only=<nom>` pour ne créer qu'un tableau. Les événements serveur émis pendant une callable portent une propriété `client` (`portal` ou `app`), ce qui permet de savoir quelles invitations, arrivées et réponses viennent du portail

### Modifié

- Push « report » d’événement : le corps dit si c’est l’heure (« passe à 16h00 au lieu de 14h30 ») ou la date (« reporté au … »), au lieu de « Maintenant … »
- Notifications push : titres raccourcis (~26 car. visibles sur écran verrouillé iOS) — type / action en premier, équipe et détails dans le corps (RSVP, rappels, récap, annonces, cotisations)
- Releases app : les notes de version (`distribution/release-notes/X.Y.Z.txt`, précédées de « Version X.Y.Z ») sont envoyées à chaque tag dans les « Nouveautés » Play (internal et brouillon production), dans la GitHub Release et dans « What to Test » TestFlight. Un tag `release-v*` prépare aussi la version App Store (Nouveautés, build attachée, sans envoi en review). Sans fichier de notes, la CI échoue.
- GitHub Actions : toutes les actions des workflows tournent sur Node.js 24 (checkout v6, upload-artifact v6, download-artifact v7, setup-java v5, paths-filter v4, auth v3, action-gh-release v3), ce qui supprime les avertissements de dépréciation de Node.js 20
- Cloud Functions et CI passées en Node.js 22 : Google retire le runtime Node.js 20 des Cloud Functions le 30/10/2026 (plus aucune mise à jour possible après)
- Déploiement des Functions : un seul tag `functions-v*` (le tag `functions-dev-v*` est supprimé) et un workflow sérialisé. Chaque déploiement pousse déjà les variantes `*Dev` et prod ; les deux tags lancés ensemble se disputaient la création des nouvelles functions (409 en boucle jusqu’au timeout), ce qui a fait échouer le déploiement de la 2.2.12

## [2.2.12] - 2026-10-27

### Ajouté

- Notifications : chaque coach choisit quand recevoir le bilan des réponses (Paramètres > Notifications) : 2 jours avant, la veille au soir (par défaut) ou avec le rappel du jour J
- Demandes de rôle : les admins voient enfin les demandes « changer de rôle » envoyées depuis une invitation.
  - Dans « À faire », une seule ligne résume les demandes (« 2 demandes de rôle à regarder »). Un écran dédié permet ensuite d’accepter ou de refuser chacune d’un tap.
  - Seules les demandes traitables tout de suite sont affichées : le demandeur a rejoint le club et son rôle diffère.
  - Le traitement passe par la nouvelle callable `resolveJoinRequest` (`resolveJoinRequestDev`), qui applique le rôle et le statut dans une même transaction et garde la protection « dernier admin ».
  - Les règles Firestore interdisent désormais au client de modifier une demande.
- Planning : les parents sans fiche membre ont aussi les vues semaine et mois, limitées aux équipes de leur enfant (une requête par équipe, comme la vue jour)
- Planning membre : avec plusieurs clubs, l’état vide propose « Voir le planning d’un club » via une feuille de choix du club

### Corrigé

- Fiche club joueur : « Impossible de charger le parent » quand aucun parent n’était lié — la lecture des invitations était refusée au joueur ; il peut maintenant lire celles de sa propre fiche, et l’app tolère un refus résiduel

### Modifié

- Dark mode : les cartes et tuiles à accent (bordure ou bandeau club) ont un halo teinté discret pour mieux se détacher du fond ; rendu clair inchangé
- Fiche club :
  - un vrai aperçu remplace la grille de tuiles. On y trouve un en-tête aux couleurs du club (logo, rôle, chiffres clés), le prochain événement toujours visible avec le RSVP, et une section « À faire » (autres convocations, cotisation à régler).
  - les raccourcis affichent une info utile (événements de la semaine, équipes, état de la cotisation, dernière annonce) avec titre et icône sur la même ligne ; la zone staff s’appelle « Côté admin » / « Côté coach » et ses tuiles reprennent les couleurs du club
  - l’en-tête (logo, nom, rôle, chips) est centré et compact ; les chips d’info sont plus petites que le badge de rôle ; un admin ouvre l’apparence en tapant le bloc identité (plus d’icône crayon)
  - le titre affiche le nom du club
- Paramètres club : un seul bouton « Enregistrer », une confirmation avant de quitter avec des modifications, des erreurs lisibles et un message clair pour les non-admins
- Équipes : retirer un joueur, un coach ou un membre en attente demande confirmation et affiche un message de succès. Les cartes résument l’effectif, les boutons d’ajout ont des libellés distincts et les états vides proposent de créer une équipe.
- Membres :
  - les sections Membres / Parents deviennent un sélecteur segmenté et « Gérer les équipes » une ligne à part
  - un message de succès s’affiche au changement de rôle et à la suppression
  - l’état vide propose d’ajouter un membre
- Cotisations admin : « Marquer payé » (unitaire et en masse) demande confirmation, avec la progression en masse. Une carte de suivi montre le taux payé, l’encaissé et le restant. « Exporter CSV » devient « Copier en CSV ».
- Ma cotisation : le bouton « Payer en ligne » est placé sous le montant dû, la saison a un vrai titre, l’attestation a une icône de téléchargement et les admins ont un raccourci vers la configuration quand la saison est vide
- Planning club : la synchro agenda a sa propre icône. Les joueurs ont aussi les vues semaine et mois, en lecture seule. Un jour vide propose « Aller au prochain événement ».
- Ajout d’événement : la date passe juste après le type, la raison du blocage s’affiche sous le bouton, quitter un formulaire modifié demande confirmation, et l’accès refusé affiche un message au lieu de se fermer tout seul
- Mes clubs : les invitations s’affichent en tête, refuser demande confirmation, les boutons suivent le thème et les emojis sont remplacés par des icônes
- Annonces :
  - les annonces actives et clôturées sont séparées (section repliable)
  - l’édition réutilise la feuille de création
  - « Supprimer » est en rouge
  - l’état vide propose de publier
- Erreurs : un bouton « Réessayer » sur les écrans planning, membres, équipes, cotisations, annonces et clubs
- Paramètres : le hub ne montre plus que le profil, quatre catégories en sous-pages (Compte et sécurité, Notifications, Apparence, Confidentialité), les clubs et un bouton « Se déconnecter » discret en bas, avec la version de l’app
- Suppression du compte : sortie du hub, elle est rangée dans la « Zone sensible » en bas de Compte et sécurité et passe par un écran dédié. Il explique ce qui est effacé ou anonymisé, prévient les admins de club et demande de taper « SUPPRIMER ». Il remplace la boîte de dialogue, dont le texte était inexact (« données club non purgées »).
- Accueil : avec un seul club, l’accès au club en bas d’écran devient une grande pastille (logo, nom du club, « Ouvrir le club ») au lieu du petit logo à côté du +
- Notifications « événement modifié » : les corrections sont regroupées pendant 10 min au lieu de 2 (2 min si l’événement a lieu le jour même)
- Bilan des réponses pour les coachs : envoyé par défaut la veille au soir au lieu de 2 jours avant
- Équipes : `members.teamIds` est maintenu côté serveur à chaque écriture d’équipe (Function `onTeamWritten`). L’app ne répare plus les rosters à l’ouverture de l’ajout de membre ; rattrapage des anciennes données via `tool/backfill_member_team_ids.mjs`.
- Planning membre : requêtes bornées à la fenêtre de 14 jours et équipes du joueur lues par requête ciblée, au lieu d’écouter toute la collection `teams` et tous les événements futurs.
- Rappels de cotisation sur l’accueil : le prénom de l’enfant n’est plus relu à chaque mise à jour de la cotisation.

### Corrigé

- Démarrage : un refus Firestore ou App Check (Play Integrity, Enforce) n’enchaîne plus l’écran de chargement. Écran stable avec réessai, et erreur lisible dans Crashlytics (`startup_session_blocked`, code + message)
- Onboarding / invitation : « Se déconnecter » / « Utiliser un autre compte » sur club-setup, preview d’invitation et entry quand on est déjà connecté — évite d’être coincé sans club (mauvais e-mail vs invitation)
- Connexion depuis une invitation : conserve l’intent `join` pour ne plus forcer le wizard création de club
- Sécurité (règles Firestore) : un coach ne peut plus obtenir les droits admin. Une fiche qu’il pré-crée est plafonnée à joueur ou coach, sans compte lié. Le rôle d’une invitation ne se modifie plus après sa création, un coach ne touche plus aux invitations admin, et les invitations parent ne se modifient plus côté client.
- Planning, accueil, annonces, cotisations : les listes suivent à nouveau les changements en direct (ajout à une équipe, nouvelle saison, compte lié). Les flux imbriqués restaient figés sur leur première valeur.
- Dates des anciens événements (sans `dateId`) : jour lu en UTC, plus dans le fuseau du téléphone (affichage la veille à partir de UTC-3).
- Paiement CB : un seul paiement ouvert par cotisation (le précédent est annulé), crédit borné au reste dû, et remboursement automatique d’un paiement arrivé après le solde. Les aides en attente redéclarées remplacent l’ancienne au lieu de s’empiler.
- Cotisations (admin) : ajustement, aides et statut sont relus au moment d’enregistrer, une écriture concurrente n’est plus écrasée.
- Suppression de compte : refusée pour le dernier admin d’un club. En cas d’échec partiel, le compte est conservé et la suppression peut être relancée, au lieu de laisser des données orphelines. Les sous-collections du profil sont aussi supprimées.
- Invitations en attente (sélecteur de club) : message d’erreur lisible, plus d’exception brute.
- Rejoindre par code : la flèche retour ne plante plus quand l’écran est ouvert par un lien (retour à l’accueil).
- RSVP depuis l’accueil et le planning : une erreur réseau affiche un message au lieu d’échouer en silence, sans lecture Firestore en plus ni rechargement complet du planning.
- Fiche club et détail membre : plus d’erreur quand l’écran est fermé pendant une action en cours.
- Notifications planifiées (rappels, récap hebdo, cotisations, push RSVP / « modifié ») : une requête collection group par passage au lieu d’une par club ; un club ou un événement en erreur n’arrête plus la tournée ; rappels marqués avant l’envoi (pas de doublon) ; récap hebdo et rappels cotisation envoyés une seule fois par semaine ; délai max porté à 9 min. Nouveaux index `fieldOverrides` à déployer avant les Functions.

### Sécurité

- Règles Firestore : le compte Stripe du club et les champs de rapprochement CB ne s’écrivent plus que par les Cloud Functions ; une entrée du journal de cotisation est signée par son auteur, horodatée serveur et cohérente avec la fiche.
- Profils `users` : lisibles seulement par leur titulaire et par les comptes qui partagent un club avec lui (membre ou parent), plus par n’importe quel compte connecté. Nouveau champ serveur `memberClubIds` (trigger `onUserWrittenSyncClubIds`, rattrapage `tool/backfill_member_club_ids.mjs`).
- Invitations nominatives et liens parent : acceptés seulement avec un e-mail confirmé. L’app propose d’envoyer le lien de confirmation puis relance l’acceptation.
- Règles Firestore, droits des coachs : le réglage « inviter des joueurs » s’applique aussi aux invitations et fiches créées directement ; un coach ne crée plus d’équipe, ne modifie que les équipes qu’il encadre, ne touche plus à la liste des coachs, et son roster joueurs suit le réglage « gérer les effectifs ».

### Note

- Version app : `pubspec.yaml` / `ProjectConfig` en `2.2.12+18`

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
