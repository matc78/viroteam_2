# ViroTeam v2 — Chat in-app (MVP)

Messagerie club pour remplacer les liens WhatsApp équipe / parents.

## Périmètre MVP

- Texte + photos + sondages (groupes > 2, style WhatsApp).
- Conversations système : `team`, `parents`, `staff`, `club`, `category`.
- DM / groupe coaches : joueurs et parents uniquement vers coaches de leurs équipes ou admins (callable `createCoachDm`).
- Réactions emoji, soft-delete, mute, rename (`titleOverride`), avatar groupe (`avatarUrl`), favoris (`chatState.favorite`).
- Reply / citation (`replyToMessageId`, `replyToText`, `replyToSenderUid`).
- Pagination historique (fenêtre live + « charger plus »).
- Push 1 notif / message + préférence `chat`.
- Fin de saison : purge des messages et des médias Storage (avatar des groupes conservé).

## Chemins Firestore

```
clubs/{clubId}/conversations/{convId}
clubs/{clubId}/conversations/{convId}/messages/{msgId}
users/{uid}/chatState/{clubId}_{convId}
```

Storage médias : `clubs/{clubId}/chat/{convId}/{uid}/{messageId}.jpg` (+ `{messageId}_thumb.png` app, `_thumb.jpg` portail)
(uid = uploader ; règles Storage owner-only ; affichage via `downloadUrl` / `thumbUrl` tokenisés)

Avatar groupe (non-canal) : `clubs/{clubId}/chat/{convId}/{uid}/avatar.jpg` → champ `avatarUrl` sur la conversation.
Tout participant peut changer la photo (même règle que `titleOverride`). Canaux (`admins_only` / `coaches_and_admins`) : pas d’avatar custom.

## Qui écrit quoi

| Donnée | Écrite par |
|--------|-----------|
| Conversation (création, participants, `writePolicy`) | Cloud Functions uniquement (`sync.ts`, `createCoachDm`, `createCategoryChannel`) |
| Aperçu inbox (`lastMessage*`, `lastSender*`) | Trigger `onChatMessageCreatedForPush` (création), `onChatMessageUpdated` (édition, suppression) |
| `titleOverride`, `avatarUrl` | Client participant (règles) |
| Message | Client (création, réactions, votes, édition, soft-delete) ; le serveur pose `fanoutAt` et fige `replyToText` / `replyToSenderUid` d'après le message cité |
| Média d'un message supprimé | Trigger `onChatMessageUpdated` (photo + miniature supprimées) |
| `chatState.unreadCount` | Trigger (incrément), client (remise à zéro à la lecture) |

Soft-delete : `deletedAt` (horodatage serveur) + `deletedByUid` **et** retrait du contenu
(`text`, `downloadUrl`, `thumbUrl`, `reactions`, `replyTo*`, `poll*`) dans la même écriture.
Autorisé à l'auteur, à un admin du club, ou à un coach sur le chat `team` / `parents` d'une équipe qu'il encadre.

## Conversation

| Champ | Type | Notes |
|-------|------|-------|
| `type` | string | `team` \| `parents` \| `staff` \| `club` \| `category` \| `dm` \| `coach_group` |
| `systemKey` | string? | Idempotence : `team:{id}`, `parents:{id}`, `staff`, `club`, `dm:{uids triés}`, canaux ciblés `category:{a\|b}`, `custom-teams:{…}`, `custom-parents:{…}` (scope relu depuis la clé) |
| `teamId` | string? | |
| `categoryKey` | string? | |
| `title` | string | Titre généré |
| `titleOverride` | string? | Renommage user |
| `avatarUrl` | string? | Photo du groupe (groupes ouverts uniquement) |
| `participantUids` | string[] | Auth uids (rules + queries) |
| `writePolicy` | string | `open` \| `admins_only` \| `coaches_and_admins` \| `closed` (DM dont l'autre participant a quitté le club) |
| `lastMessageAt` | timestamp | |
| `lastMessagePreview` | string | |
| `lastSenderUid` | string? | |
| `lastSenderFirstName` / `lastSenderRole` | string? | Rôle : `player` \| `coach` \| `admin` \| `parent` |
| `createdAt` / `updatedAt` | timestamp | |

## Message

| Champ | Type |
|-------|------|
| `type` | `text` \| `image` \| `poll` |
| `text` | string? |
| `storagePath` / `downloadUrl` / `thumbUrl` | string? |
| `width` / `height` | number? |
| `senderUid` | string |
| `createdAt` | timestamp |
| `deletedAt` / `deletedByUid` | soft-delete |
| `reactions` | map emoji → uid[] |
| `pollQuestion` | string? (type `poll`) |
| `pollOptions` | `{id, text}[]` (2–12) |
| `pollVotes` | map optionId → uid[] |
| `pollAllowMultiple` | bool (défaut false) |
| `replyToMessageId` | string? | id message cité |
| `replyToText` | string? | extrait snapshot |
| `replyToSenderUid` | string? | auteur cité |
| `editedAt` | timestamp? | dernière édition |
| `fanoutAt` | timestamp? | posé par le trigger (idempotence) |

Sondages : création uniquement si `participantUids.size > 2`. Vote = update `pollVotes` (transaction client).

## chatState (par user)

`muted` (bool), `favorite` (bool), `lastReadAt`, `unreadCount`

Tri inbox : favoris d’abord, puis `lastMessageAt` desc.

## Mineurs

Heuristique `isYouthTeamCategory` (U/M/- ≤ 13). En MVP la restriction DM s’applique à tous.

## Sync

- `onTeamWritten` → upsert `team` + `parents`, recalcul participants ; canaux ciblés recalculés si le roster ou la catégorie change.
- Retrait roster → uid retiré de `participantUids` (plus d’accès / historique).
- Fiche membre (rôle, statut, compte lié) → ajout / retrait ciblé dans `staff` + `club` ; une fiche qui quitte le club sort de ses DM, groupes coachs et canaux.
- `adminIds` du club → resync `staff` + `club`.
- Lien guardian activé / révoqué → resync `parents` des équipes de l’enfant + canaux ciblés ; un parent sans plus aucun lien dans le club sort de ses DM.
- Suppression de compte → messages de la personne vidés, uid retiré des conversations.
- **Réparation** : callable `ensureClubChatSynced` (admin du club, une resync / 5 min) ;
  `backfillMyAdminClubChats` pour tous les clubs admin de l’appelant. Plus appelée à l’ouverture de l’inbox.
