# Recette messagerie (avant ouverture des flags)

La messagerie s’ouvre (`FeatureFlags.chatMessagingLive` côté app, `NEXT_PUBLIC_CHAT_MESSAGING_LIVE` côté portail) quand ce parcours passe **sans défaut** sur toute la matrice ci-dessous. Un défaut = une ligne cochée « KO » avec un lien vers le ticket ou le commit correctif ; on rejoue la ligne après correction.

Accessibilité générale : [`A11Y_SMOKE.md`](A11Y_SMOKE.md). Plan et décisions : doc « Messagerie — plan UI/UX app + portail » (lots 0 à 6).

---

## Prérequis

- Functions déployées (tag `functions-v*`) puis rattrapage lancé : `backfillMyAdminClubChats` sur chaque club de test (profils participants du lot 0).
- Règles Firestore rejouées : `cd rules-tests && npm test` (JDK 21+).
- Un club de test avec au moins : 1 admin, 1 coach, 2 joueurs, 1 parent rattaché à un enfant joueur, 2 équipes, 1 canal « coachs et admins ».
- Portail lancé avec `NEXT_PUBLIC_CHAT_MESSAGING_LIVE=true`. App en debug (le flag est actif en `kDebugMode`).

## Matrice

Chaque parcours (A à F) est joué sur chaque colonne. Les rôles tournent : chaque colonne est jouée au moins une fois en joueur, en parent et en admin.

| Plateforme | Thème clair | Thème sombre | Rôle(s) joué(s) | Testeur | Date |
|---|---|---|---|---|---|
| iOS (TestFlight ou debug sur appareil) | ☐ | ☐ | | | |
| Android (appareil) | ☐ | ☐ | | | |
| Portail desktop (≥ 1025 px) | ☐ | ☐ | | | |
| Portail tablette (768–1024 px) | ☐ | — | | | |
| Portail mobile (< 768 px, appareil ou émulation) | ☐ | ☐ | | | |
| App en `--dart-define=FORCE_PROD_BACKEND=true` (base `v2-prod`) | ☐ | — | | | |

En `FORCE_PROD_BACKEND`, jouer seulement A, B et C, sur un club de test de la prod, puis supprimer les messages de test.

---

## A. Inbox

| # | Étape | Attendu | OK |
|---|---|---|---|
| A1 | Ouvrir la messagerie | Squelette puis liste triée (favoris, puis dernier message) ; pastilles de non-lus correctes | ☐ |
| A2 | Rechercher un nom, un club, un mot du dernier message | Filtre fidèle au placeholder ; « Aucune discussion ne correspond… » si rien | ☐ |
| A3 | Couper le réseau puis recharger | Message d’erreur et « Réessayer » ; la liste revient après reconnexion | ☐ |
| A4 | Parent : ouvrir l’inbox | Conversations de l’enfant visibles, noms et photos des expéditeurs présents | ☐ |

## B. Fil et envoi

| # | Étape | Attendu | OK |
|---|---|---|---|
| B1 | Ouvrir une conversation avec historique | Fil en bas, séparateur « nouveau » au premier non-lu, regroupement des messages consécutifs | ☐ |
| B2 | Envoyer 3 messages d’affilée vite | Les 3 partent, dans l’ordre, sans blocage | ☐ |
| B3 | Envoyer hors ligne | « Échec · Réessayer » ; la relance envoie une seule fois | ☐ |
| B4 | Envoyer une photo | Placeholder au bon ratio, progression (app), pas de saut de mise en page | ☐ |
| B5 | Remonter l’historique | « Charger plus » / chargement au scroll, position de lecture conservée | ☐ |
| B6 | Recevoir un message en étant remonté | Bouton « 1 nouveau message ↓ » ; le fil ne saute pas | ☐ |
| B7 | Recevoir un message, onglet portail en arrière-plan | La conversation reste non lue tant que l’onglet est caché | ☐ |
| B8 | Joueur dans un canal « coachs et admins » | Pas de composer, bandeau « Seuls les coachs et les admins peuvent écrire ici. » | ☐ |

## C. Actions sur un message

| # | Étape | Attendu | OK |
|---|---|---|---|
| C1 | Répondre | Citation dans le composer ; tap sur la citation envoyée → saut au message | ☐ |
| C2 | Réagir (barre rapide, puis « + ») | Réaction immédiate ; retrait au second tap ; « Qui a réagi » liste les bonnes personnes | ☐ |
| C3 | Modifier un de mes messages | Édition dans le composer, Échap / croix annule, mention « modifié » | ☐ |
| C4 | Supprimer un de mes messages | Confirmation, puis « Message supprimé » chez tous les participants | ☐ |
| C5 | Copier (texte) | Texte dans le presse-papiers | ☐ |
| C6 | Sondage : créer, voter, voir les votes | Votes à jour chez tous ; détail des votes par option | ☐ |

## D. Création et réglages

| # | Étape | Attendu | OK |
|---|---|---|---|
| D1 | Nouvelle conversation (DM) | Destinataires possibles chargés vite ; ouvre la conversation existante si elle existe déjà | ☐ |
| D2 | Admin : créer un canal par équipe / catégorie | Destinataires corrects ; titre suggéré | ☐ |
| D3 | Renommer un groupe, changer sa photo | Visible chez tous, inbox comprise | ☐ |
| D4 | Mute, favori | Effet immédiat ; plus de notification push quand muet | ☐ |
| D5 | Notification push d’un message | Le tap ouvre la bonne conversation (app et portail) | ☐ |

## E. Accessibilité

| # | Étape | Attendu | OK |
|---|---|---|---|
| E1 | App, VoiceOver / TalkBack sur une bulle | Actions « Répondre », « Réagir avec un cœur », « Plus d’actions » proposées | ☐ |
| E2 | App : emojis, réactions, avatar de l’en-tête, menu ⋮, « + » | Chaque élément annonce un nom ; cibles confortables (≥ 44) | ☐ |
| E3 | Portail au clavier seul : Tab jusqu’à une bulle | Bouton « Actions du message » visible au focus ; Entrée ouvre les actions ; Échap ferme et rend le focus | ☐ |
| E4 | Portail : menu Options et menu « + » | Flèches haut / bas, Échap ferme le menu sans fermer la fenêtre | ☐ |
| E5 | Portail : panneau infos / sondage ouvert | Focus dans le panneau ; Échap le ferme ; Tab peut en sortir (non modal) | ☐ |
| E6 | Portail : fenêtre flottante ouverte | Tab permet de rejoindre le dock et la page | ☐ |
| E7 | Portail, lecteur d’écran : recevoir un message | Annonce « Nouveau message de … » une fois ; rien au chargement ni en remontant l’historique | ☐ |
| E8 | Portail : formulaire sondage vide, renommage en échec | Erreur annoncée (`role="alert"`), champ marqué invalide | ☐ |

## F. Portail mobile et responsive

| # | Étape | Attendu | OK |
|---|---|---|---|
| F1 | < 768 px : page Messages | Liste seule ; un tap ouvre le fil en plein écran | ☐ |
| F2 | < 768 px : bouton retour du fil | Retour à la liste, l’URL perd `clubId` / `conversationId` | ☐ |
| F3 | < 768 px : ouvrir une conversation depuis le dock ou une notif | Arrive sur la page Messages, fil ouvert | ☐ |
| F4 | 768–1024 px : panneau infos | Par-dessus le fil, fermeture qui rend le fil intact | ☐ |
| F5 | Redimensionner à travers 767 / 1024 px | Pas de layout cassé ni de double barre de défilement | ☐ |

---

## Ouverture

Quand toute la matrice est verte :

1. `lib/config/feature_flags.dart` : `chatMessagingLive` → `true` (au lieu de `kDebugMode`).
2. Portail : ajouter la variable `NEXT_PUBLIC_CHAT_MESSAGING_LIVE` (valeur `"true"`, disponible au build) dans `portal/apphosting.yaml`, puis mettre à jour le commentaire de `CHAT_MESSAGING_LIVE` (`portal/src/lib/featureFlags.ts`).
3. Changelogs : retirer « (masquée) » des entrées messagerie de `[Unreleased]`, ajouter l’entrée d’ouverture.
4. Release app (`v*`) et portail (`portal-v*`) dans la même fenêtre, pour que l’app et le portail ouvrent ensemble.
