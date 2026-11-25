# Synchro fédération (FFVB) : calendrier et classement

## Objectif

Une équipe de volley liée à sa poule FFVB récupère automatiquement ses matchs (planning) et le classement de la poule, sans saisie manuelle. Saison test 2026/2027.

## Parcours

1. **Liaison**. Le coach de l’équipe, ou un membre ayant le droit `manageTeams`, ouvre l’onglet Équipes > Gérer, puis « Lier le calendrier FFVB » :
   - il colle le lien `https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier.php?saison=…&codent=…&poule=…` ;
   - `previewFederationLink` lit la poule et propose ses équipes ;
   - il choisit la sienne ;
   - `linkTeamFederation` enregistre le lien et importe la saison **en silence** (`silentWriteAt`).
2. **Synchro**. La tâche `syncFederationTeams` tourne tous les 2 jours à 5h (Europe/Paris). Le bouton « Actualiser » (`refreshTeamFederation`) est limité à une fois toutes les 10 min par équipe. Ces synchros ne sont pas silencieuses : le trigger d’événement existant notifie l’équipe.
3. **Classement**. Visible par les joueurs, coachs et parents de l’équipe, depuis la coupe de la home ou le bouton « Classement » de « Mes équipes ». Un tap sur une ligne ouvre la saison de l’équipe : rang, forme, bilans, salles et parcours.
4. **Déliaison** (`unlinkTeamFederation`). Supprime le lien, le classement et les matchs de la poule. Les événements déjà importés restent dans le planning, sauf si le coach coche « Supprimer aussi les matchs importés » (`deleteImportedMatches`, lien erroné) : les événements `source: ffvb` d'id `ffvb_{teamId}_…` sont supprimés sans notification, les matchs saisis à la main sont gardés.

## Source FFVB

| Donnée | Page | Remarques |
|---|---|---|
| Classement, intitulé de poule | `vbspo_calendrier.php` (HTML, ISO-8859-1) | tableau « Points Jou. Gag. … » |
| Matchs | `vbspo_calendrier_export.php` (POST, CSV `;`) | dates ISO, nom de salle, `3/P` = forfait |
| Adresse de salle | `adressier/fiche_match_ffvb.php` (POST → PDF) | rue + CP/ville ; le CSV ne donne que le nom (`PERDREAU`) |

- Seules des URL reconstruites à partir de saison, entité, poule (et code match pour la fiche) sont appelées, jamais le lien brut.
- Une seule lecture HTML/CSV par poule et par exécution ; les fiches match déjà enrichies (adresse avec chiffre) ne sont pas re-téléchargées.
- Le parseur est testé sur une page / PDF réels : `functions/src/federation/__fixtures__/`.
- Si la FFVB change son format : `lastSyncStatus: "error"` sur l’équipe, une erreur dans les logs, et les données précédentes sont conservées.

## Données

- `teams/{teamId}.federation` (écrit par les Functions uniquement) :
  - `provider: "ffvb"`, `url`, `season`, `codent`, `pool`, `poolLabel` ;
  - `teamKey`, `teamName` ;
  - `linkedBy`, `linkedAt`, `lastSyncAt`, `lastSyncStatus`, `lastSyncError`, `lastManualSyncAt`.
- `teams/{teamId}/federation/standings` : `{ poolLabel, teamKey, rows[], fetchedAt }`.
- `teams/{teamId}/federation/matches` : `{ teamKey, matches[], fetchedAt }`, toute la poule. Une salle déjà connue est conservée si la fédé n’en publie plus, ou si c’est l’adresse complète du même nom court ; une autre salle publiée la remplace (vrai changement, notifié).
- Événement `events/ffvb_{teamId}_{code}` : champs usuels d’un match, plus `source: "ffvb"`, `externalMatchId`, `opponentName` et `score { us, them, sets[], forfeit? }`.
  - La synchro ne modifie que `date`, `dateId`, `startTime`, `location`, `matchVenue`, `opponentName` et `score`.
  - Le RDV, les convocations, le RSVP et les exclusions restent au coach.
  - Un événement annulé n’est plus touché.
  - Un événement supprimé par le coach n’est pas recréé (match déjà présent à la synchro précédente) ; une nouvelle liaison réimporte tout.
  - Un match disparu de la poule est seulement journalisé.

## Notifications

Elles passent par le trigger `onEventWrittenForPush`, sans logique dédiée :

| Changement | Notification |
|---|---|
| Date ou heure | « reporté » |
| Salle ou domicile / extérieur | « modifié » (regroupé) |
| Nouveau match dans les 7 jours (hors import) | « nouveau » |
| Score | aucune |

## Clé d’équipe

`teamKey` est le slug du nom publié (`USM DE VIROFLAY` → `usm-de-viroflay`). Il est commun au classement et aux matchs, et utilisé dans la route `/club/:clubId/teams/:teamId/standings/:poolTeamKey`.

## Limites connues

- FFVB uniquement : le champ `provider` prévoit d’autres fédérations.
- Le site FFVB n’offre pas d’API officielle. La lecture repose sur le format actuel des pages / PDF FPDF.
- Si une fiche match est illisible, le nom court de salle du CSV est conservé.
- Le portail n’affiche ni le lien ni le classement.
