# ViroTeam v2 — Chat in-app (MVP)

Messagerie club pour remplacer les liens WhatsApp équipe / parents.

## Périmètre MVP

- Texte + photos + sondages (groupes > 2, style WhatsApp).
- Conversations système : `team`, `parents`, `staff`, `club`, `category`.
- DM / groupe coaches : joueurs et parents uniquement vers coaches de leurs équipes ou admins (callable `createCoachDm`).
- Réactions emoji, soft-delete, mute, rename (`titleOverride`).
- Push 1 notif / message + préférence `chat`.
- Fin de saison : purge des messages (Storage conservé).

## Chemins Firestore

```
clubs/{clubId}/conversations/{convId}
clubs/{clubId}/conversations/{convId}/messages/{msgId}
users/{uid}/chatState/{clubId}_{convId}
```

Storage médias : `clubs/{clubId}/chat/{convId}/{uid}/{messageId}.jpg`
(uid = uploader ; règles Storage owner-only ; affichage via `downloadUrl` tokenisé)

## Conversation

| Champ | Type | Notes |
|-------|------|-------|
| `type` | string | `team` \| `parents` \| `staff` \| `club` \| `category` \| `dm` \| `coach_group` |
| `systemKey` | string? | Idempotence : `team:{id}`, `parents:{id}`, `staff`, `club`, `category:{key}` |
| `teamId` | string? | |
| `categoryKey` | string? | |
| `title` | string | Titre généré |
| `titleOverride` | string? | Renommage user |
| `participantUids` | string[] | Auth uids (rules + queries) |
| `writePolicy` | string | `open` \| `admins_only` \| `coaches_and_admins` |
| `lastMessageAt` | timestamp | |
| `lastMessagePreview` | string | |
| `lastSenderUid` | string? | |
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

Sondages : création uniquement si `participantUids.size > 2`. Vote = update `pollVotes` (transaction client).

## chatState (par user)

`muted` (bool), `lastReadAt`, `unreadCount`

## Mineurs

Heuristique `isYouthTeamCategory` (U/M/- ≤ 13). En MVP la restriction DM s’applique à tous.

## Sync

- `onTeamWritten` → upsert `team` + `parents`, recalcul participants.
- Triggers membres / adminIds → upsert `staff` + `club`.
- Retrait roster → uid retiré de `participantUids` (plus d’accès / historique).
- **Backfill** : callable `ensureClubChatSynced` (par club) + ouverture inbox app ;
  `backfillMyAdminClubChats` pour tous les clubs admin de l’appelant.
