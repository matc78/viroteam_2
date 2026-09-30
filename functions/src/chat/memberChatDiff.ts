import { stringArray } from "../common";

/**
 * Champs d'une fiche membre qui influencent les chats système (`staff`,
 * `club`) : rôle, statut, compte lié, équipes. Tout autre changement
 * (profil, snapshot, RSVP…) ne doit pas relancer `syncClubWideConversations`
 * — c'était un resync complet du club à chaque écriture de fiche.
 */
export function memberChatFieldsChanged(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  // Création ou suppression : toujours resync.
  if (!before || !after) return true;
  const scalar = ["role", "status", "accountUid", "userId"] as const;
  for (const key of scalar) {
    if (String(before[key] ?? "") !== String(after[key] ?? "")) return true;
  }
  const beforeTeams = stringArray(before.teamIds).slice().sort().join(",");
  const afterTeams = stringArray(after.teamIds).slice().sort().join(",");
  return beforeTeams !== afterTeams;
}

/** Politiques d'écriture acceptées pour un canal ciblé. */
export const CHANNEL_WRITE_POLICIES = new Set([
  "open",
  "admins_only",
  "coaches_and_admins",
]);

/** Longueur max d'un titre de conversation (aligné firestore.rules). */
export const CONVERSATION_TITLE_MAX = 80;
