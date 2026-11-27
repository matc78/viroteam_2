# ViroTeam v2 — Droits des membres (« droits purs »)

> Cible : app 2.4.0 (mise à jour obligatoire), portail, Functions et règles déployés dans la même fenêtre.
> Remplace le modèle `player ⊂ coach ⊂ admin` (champ `members/{id}.role`).

## Pourquoi

Un club doit pouvoir confier une responsabilité précise (cotisations, annonces, matériel…) à un membre sans le promouvoir coach ou admin. Le rôle unique ne le permettait pas, et il était comparé en dur à plus de 100 endroits avec plusieurs définitions divergentes d'« admin ».

## Principes

1. **Seuls les droits autorisent.** `members/{id}.permissions: string[]`, écrit uniquement par les Cloud Functions, est la seule autorité.
2. **Pas de rôle, pas de modèle.** On attribue la bascule Administrateur, des fonctions prédéfinies ou des droits à la carte. Être coach ou joueur, c'est figurer dans une équipe (`teams.coachIds` / `playerIds`), pas un droit. Plus de demande de rôle.
3. **Un droit vaut pour tout le club.**
4. **Coach d'équipe = relation** (`teams.coachIds`), comme parent. Elle donne des capacités sur ses seules équipes, réglées pour tout le club par `clubs.coachPermissions`.
5. **Parent = relation** (inchangé, voir [`viroteam_v2_parents_spec.md`](viroteam_v2_parents_spec.md)).
6. **Badges dérivés**, jamais stockés : Admin (droit `admin`), Entraîneur (coach d'au moins une équipe), Joueur (dans un effectif qu'il n'encadre pas), sinon **Membre** (aplat gris simple) ; Parent vient des liens. Badge unique (bulle, avatar, fiche) : Admin > Entraîneur > Joueur > Membre ; dans le sélecteur de club, une fiche Membre avec des liens parent affiche Parent.

## Catalogue

Source canonique : [`shared/permissions_catalog.json`](../../shared/permissions_catalog.json). Chaque couche a son catalogue typé et un test de parité contre ce JSON :

| Couche | Catalogue | Point d'entrée |
|---|---|---|
| Functions | `functions/src/permissionsCatalog.ts` | `functions/src/permissions.ts` (`loadClubAccess`, `assertPermission`, `assertPermissionOrTeamCoach`, `writeMemberPermissions`) |
| App | `lib/models/club_permission.dart` | `ClubAccess` (`lib/models/club_access.dart`) via `clubAccessProvider` ; garde de route `ClubAccessGuard` |
| Portail | `portal/src/lib/auth/permissions.ts` | `bureauCapabilities(access)` / `useBureauCapabilities()` |
| Règles | — | `can()`, `coachCan()`, `coachesAll` / `coachesAny`, `canAddMembers` |

### Droits club

| Id | Couvre |
|---|---|
| `admin` | Protégé. Implique tous les autres (présents et futurs) ; seul à attribuer des droits, régler les capacités coach, gérer Stripe Connect |
| `manageMembers` | Ajouter / inviter / importer, éditer les fiches, retirer, liens parents |
| `manageTeams` | Créer / supprimer des équipes, nommer les coachs, effectifs de toutes les équipes |
| `manageEvents` | Événements, convocations, appel, RSVP d'autrui, tout le club |
| `manageAnnouncements` | Annonces vers tout le club, toute équipe, toute catégorie |
| `manageFees` | Saisons, encaissements, aides, exonérations (implique `viewFees`) |
| `viewFees` | Suivi des cotisations en lecture |
| `manageClubSettings` | Identité, apparence / logo, lieux, saison |
| `manageEquipment` | Matériel |
| `manageChat` | Créer des canaux, écrire en `admins_only`, modérer |
| `viewActivity` | Journal d'activité |

Normalisation serveur : `manageFees` ajoute `viewFees` ; `admin` présent ⇒ `['admin']`.

### Fonctions prédéfinies (non stockées)

Responsable cotisations (`manageFees`, `viewFees`) · Responsable annonces (`manageAnnouncements`) · Responsable membres (`manageMembers`, `manageTeams`) · Responsable sportif (`manageEvents`, `manageTeams`) · Responsable matériel (`manageEquipment`). Ce sont des raccourcis UI de **droits club** (non stockés) : une fonction est cochée si tous ses droits sont présents, partielle sinon. Enrichir une fonction plus tard ne modifie pas les membres existants. La feuille d’attribution sépare aussi les **capacités d’équipe** (lecture seule : relation `teams.coachIds` + flags `clubs.coachPermissions`), distinctes des droits club.

### Badges : où s'affiche quoi

| Vue | Badge |
|---|---|
| Fiche membre, vue Membres, sélecteur de club, chat | Badge club : Admin > Entraîneur > Joueur > Membre |
| Vue équipe | Rôle dans cette équipe (Entraîneur / Joueur / Sparring), jamais Admin. Sparring (gris argent) = joueur de `teams.sparringIds`, non convoqué par défaut aux matchs ; aussi sur les lignes de convocation d'un match et dans le libellé « Équipe (sparring) » de la fiche |
| RSVP d'un événement d'équipe | Entraîneur si coach d'une équipe de l'événement, sinon rien |
| RSVP d'un événement spécial (`allTeams` ou aucune équipe) | Admin si la fiche a le droit `admin`, sinon comme ci-dessus |

### Capacités coach d'équipe (`clubs.coachPermissions`)

| Flag | Défaut | Capacité (sur ses équipes seulement) |
|---|---|---|
| `canCreateEvents` | vrai | Créer / modifier / annuler / notifier les événements de ses équipes : il doit entraîner **toutes** les équipes de l'événement, jamais « tout le club » (`allTeams`) |
| `canManageTeamRoster` | vrai | Ajouter des joueurs (retrait : `manageTeams`) |
| `canInvitePlayers` | vrai | Code d'équipe, pré-création de fiche, invitation — fiches sans droit, de ses équipes ou sans équipe |
| `canPublishTeamAnnouncements` | vrai | Annonces ciblant uniquement ses équipes |
| `canEditMemberLicenses` | faux | Licences des membres de ses équipes |
| `canEditMemberRsvp` | faux | RSVP d'autrui sur ses événements (hors « tout le club ») ; compte dans les présences comme une réponse du joueur |

Pas d'appel coach : les présences reposent uniquement sur le RSVP (« présent » = a répondu oui). L'ancien droit `canTakeAttendance` et le champ `events.attendance` ne sont plus écrits.

Sans flag : liens de discussion, écriture en `coaches_and_admins`, canal staff, modération des conversations de ses équipes. Les convocations / push d'un événement suivent la portée de `canCreateEvents` (toutes ses équipes, jamais « tout le club »). Réglage par un admin seulement.

## Modèle de données

| Champ | Rôle | Écrivain |
|---|---|---|
| `members/{id}.permissions` | Autorité unique (aussi sur fiche non liée, suit le re-keying par union) | `setMemberPermissions`, `createClub`, migration |
| `members/{id}.coachTeamIds` | Relation coach dérivée de `teams.coachIds` (un seul `get()` dans les règles) | Trigger `onTeamWritten` (`parentTeams.ts`, relit l'équipe courante) |
| `members/{id}.teamIds` | Équipes de la fiche (joueur ou coach), dérivées des rosters | Trigger `onTeamWritten`, callables d'arrivée (`acceptTeamInvitation`) |
| `members/{id}.accountUid` | Seul lien fiche → compte (plus de `userId` ni de `memberId`) | `acceptInvitation`, `acceptTeamInvitation`, `createClub`, re-keying |
| `clubs.adminIds` | **Index d'audience** (fiches liées ayant `admin`) pour chat / notifications ; n'autorise jamais rien | Functions, calcul unique `adminIdsUpdate` (`permissionsCatalog.ts`) |
| `clubs.coachPermissions` | Flags ci-dessus | Client, droit `admin` |
| `users.memberClubIds` | Seul index des clubs du compte (règles de lecture `users`, liste des clubs) | Functions qui ajoutent / retirent un membre (`acceptInvitation`, `acceptTeamInvitation`, `createClub`, `removeMember`) |
| `invitations` | Ne portent jamais de rôle ni de droit (ils vivent sur la fiche pré-créée) | — |

Aucun client n'écrit ces champs d'accès (règle `protectedMemberFields`, y compris à la pré-création d'une fiche), ni `formerMemberIds` / `rekeyPendingFrom` / `anonymizedAt`. Une fiche pré-créée n'a jamais l'id d'un compte existant.

Supprimés : `members.role`, `coachInfo`, `members.userId`, `members.memberId`, `invitations.role`, `users.clubMemberships` (et le trigger `onUserWrittenSyncClubIds`), `coachPermissions.canViewFees` (devenu le droit `viewFees`), la collection `join_requests` (et la callable `resolveJoinRequest`), l'index `member_accounts`.

## Callables

- `setMemberPermissions({clubId, memberId, permissions})` remplace `setMemberRole` : appelant `admin`, pas d'auto-modification, au moins un admin par club, validation contre le catalogue + normalisation.
- `createClub(draft)` : le fondateur reçoit `['admin']` côté serveur (plus de création de club côté client).
- Adaptées : `removeMember` (`manageMembers`, `admin` si la cible est admin), `sendMemberInvites`, `uploadClubLogo`, `createCategoryChannel`, Stripe Connect, `acceptInvitation`, `deleteMyAccount`.

## Garde-fous

- `functions/src/permissionUsage.test.ts`, `test/permission_usage_test.dart`, `portal/src/lib/auth/permissionUsage.test.ts` : aucune comparaison de rôle, aucune lecture brute des droits hors point d'entrée.
- `rules-tests/` : écriture directe de `permissions` / `coachTeamIds` / `teamIds` / `accountUid` / `memberClubIds` refusée, `adminIds` sans effet, coach limité à ses équipes, flags appliqués, responsable cotisations cantonné.

## Migration et bascule

Script [`tool/migrate_roles_to_permissions.mjs`](../../tool/migrate_roles_to_permissions.mjs) (dry-run par défaut, `--apply`, `--club`, `--databases`), logique pure dans `functions/src/permissionsMigration.ts`.

- **Phase additive** (idempotente, `role` conservé) : admin ou uid dans `adminIds` → `['admin']` ; coach d'au moins une équipe → `['viewActivity']` (+ `viewFees` si le club avait `canViewFees`) ; coach sans équipe → `[]` (passé membre, l'admin lui réattribue des droits ou une équipe) ; joueur → `[]` ; calcul de `coachTeamIds` ; réindexation de `adminIds` ; `accountUid` ← `userId` s'il manque.
  - Club sans fiche active (vide ou seulement des fiches archivées) ou listé dans `CLUBS_TO_DELETE` (clubs de test) : supprimé (document, sous-collections, Storage `clubs/{clubId}/`, `users.memberClubIds` et `parentLinks`, index Stripe).
  - Club sans admin lié à un compte : le premier membre arrivé (`joinedAt`, fiches liées d'abord) est promu admin. Sans aucune fiche liée, un admin en attente de liaison suffit, sinon la première fiche est promue (admin à la liaison).
  - Invitation en attente porteuse d'un rôle sans fiche pré-créée : la personne arrive sans droit (assumé).
  - Rapport : clubs supprimés, admins promus, coachs passés membres, invitations à rôle, écarts `clubMemberships` ↔ `memberClubIds`. Relancée, elle sert aussi de réparation (`coachTeamIds`, `adminIds`) ; la promotion ne se refait pas une fois un admin lié présent.
- **Phase `--drop-legacy`** (après bascule) : supprime les champs et la collection listés plus haut.

Ordre :

1. Dev : script sur `v2-dev`, `firestore-dev-v*`, déploiement manuel ponctuel des seules fonctions `*Dev`, recette app debug + portail local.
2. Tag `release-v2.4.0` ; attendre l'approbation Android et iOS, publication retenue.
3. Fenêtre prod (heure creuse) : script `--apply` sur `v2-prod` → `functions-v*` → `firestore-v*` → `portal-v*` → publication de l'app sur les deux stores → `minVersionAndroid` / `minVersionIos` à `2.4.0`.
4. Plus tard : `--drop-legacy`.

Pendant la propagation des stores, les anciennes apps s'affichent (`role` encore en base) mais changement de rôle, invitation et création de club échouent jusqu'à la mise à jour.

## Changements de comportement assumés

- Les coachs ne publient plus d'annonces à l'échelle du club ou d'une catégorie (droit `manageAnnouncements`), seulement vers leurs équipes.
- Un coach ne voit plus les cotisations du club sans le droit `viewFees`.
- Un coach sans équipe ne crée plus d'événement ni d'annonce.
- Un titulaire de `manageTeams` peut se nommer coach : il gagne des capacités d'équipe, pas des droits.
- Latence de quelques secondes (trigger `coachTeamIds`) entre la nomination d'un coach et ses capacités.
