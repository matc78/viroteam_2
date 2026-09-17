# ViroTeam v2 — Messagerie portail (MVP)

UI web style LinkedIn, même backend que l’app (`docs/specs/viroteam_v2_chat_spec.md`).

## Placement

- Bouton **Messagerie** dans le header (`DashboardShell` / `FamilyShell`), à côté de Mon planning.
- Toujours visible si l’utilisateur a au moins un club.
- Badge non-lus = somme `chatState.unreadCount` hors conversations `muted`.

## Surfaces

1. **Dock bas-droite** (prioritaire) — inbox agrégée, recherche, composer, collapse.
2. **Une fenêtre flottante** — un seul thread ; ouvrir une autre conv remplace.
3. **Page** — `/messages` (bureau) et `/family/messages` (famille), keep-alive.

## Interactions

| Action | Comportement |
|--------|--------------|
| Clic bouton header | Toggle dock (pas de navigation) |
| Clic conversation (dock) | Fenêtre flottante + `markRead` |
| Maximiser / Voir tout | `/messages` ou `/family/messages?clubId=&conversationId=` |
| Composer | DM coach (`createCoachDm`) + convos système sync |
| Notif push | `/messages?clubId=&conversationId=` ; parent-only → `/family/messages?...` |
| Mobile web (&lt; 768px) | Dock / thread en plein écran ; pas de multi-fenêtres |

## Inbox

- Agrégation tous clubs (bureau + famille), tri `lastMessageAt` desc.
- Badge club sur chaque tuile.
- Preview, date, unread, mute.

## Parité MVP

Texte, photos, sondages, réactions, soft-delete, mute, favoris, rename, reply/citation ;
pagination historique ; canal catégorie (admin) ; paste/drop image composer ;
callables chat inchangés.

## Deep links

- Push `webPath` : `/messages?clubId={id}&conversationId={id}`
- Query lue par la page messages (sélection thread) et éventuellement ouverture dock.
