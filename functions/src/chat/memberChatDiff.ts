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

function snapshotField(data: Record<string, unknown>, key: string): string {
  const snapshot = data.snapshot;
  if (!snapshot || typeof snapshot !== "object") return "";
  return String((snapshot as Record<string, unknown>)[key] ?? "");
}

/**
 * Nom ou photo d'une fiche membre modifiés (→ `participantProfiles` à jour).
 * Création / suppression : `false` (déjà couvert par la resync complète).
 */
export function memberProfileFieldsChanged(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  if (!before || !after) return false;
  for (const key of ["firstName", "lastName"]) {
    if (String(before[key] ?? "") !== String(after[key] ?? "")) return true;
  }
  return ["displayName", "avatarUrl"].some(
    (key) => snapshotField(before, key) !== snapshotField(after, key),
  );
}

/** Nom ou photo d'un profil `users/{uid}` modifiés (parents dans les chats). */
export function userProfileFieldsChanged(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  if (!before || !after) return false;
  return ["firstName", "lastName", "displayName", "avatarUrl"].some(
    (key) => String(before[key] ?? "") !== String(after[key] ?? ""),
  );
}

/** Politiques d'écriture acceptées pour un canal ciblé. */
export const CHANNEL_WRITE_POLICIES = new Set([
  "open",
  "admins_only",
  "coaches_and_admins",
]);

/** Longueur max d'un titre de conversation (aligné firestore.rules). */
export const CONVERSATION_TITLE_MAX = 80;
