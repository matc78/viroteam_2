/**
 * Purge du contenu d'un message supprimé (fonctions pures, testables avec
 * `node --test`).
 *
 * Le client ne pose que `deletedAt` / `deletedByUid` (soft delete, règles
 * Firestore) : sans purge serveur, le texte, les URL de la photo et l'extrait
 * cité restaient lisibles par tous les participants. Le trigger
 * `onChatMessageUpdatedPurgeDeleted` efface ces champs, le fichier Storage et
 * l'extrait (`replyToText`) recopié dans les réponses qui le citent.
 */

/** Champs de contenu effacés d'un message supprimé. */
export const DELETED_MESSAGE_CONTENT_FIELDS = [
  "text",
  "message",
  "storagePath",
  "downloadUrl",
  "thumbUrl",
  "width",
  "height",
  "pollQuestion",
  "pollOptions",
  "pollVotes",
  "pollVoteTimes",
  "pollAllowMultiple",
  "reactions",
  "replyToMessageId",
  "replyToText",
  "replyToSenderUid",
] as const;

/** Horodatage posé une fois le contenu purgé (garde-fou anti-boucle). */
export const CONTENT_PURGED_AT_FIELD = "contentPurgedAt";

/** Aperçu de conversation quand le dernier message est supprimé. */
export const DELETED_MESSAGE_PREVIEW = "Message supprimé";

/**
 * True si la mise à jour supprime le message (`deletedAt` passe de vide à une
 * valeur) et que son contenu n'a pas encore été purgé.
 */
export function messageJustDeleted(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  if (!after) return false;
  return (
    before?.deletedAt == null &&
    after.deletedAt != null &&
    after[CONTENT_PURGED_AT_FIELD] == null
  );
}

/**
 * Patch de purge : chaque champ de contenu présent dans [message] reçoit
 * [deleteField] (`FieldValue.delete()`), plus [purgedAt] sur
 * `contentPurgedAt`.
 */
export function deletedMessagePurgePatch(
  message: Record<string, unknown>,
  deleteField: unknown,
  purgedAt: unknown,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { [CONTENT_PURGED_AT_FIELD]: purgedAt };
  for (const field of DELETED_MESSAGE_CONTENT_FIELDS) {
    if (field in message) patch[field] = deleteField;
  }
  return patch;
}

/**
 * Fichiers Storage d'un média de message : l'image (`storagePath`) et sa
 * miniature `<nom>_thumb.<ext>` (app : `.png`, portail : `.jpg`). Retourne
 * `null` si le chemin n'est pas un média de cette conversation
 * (`clubs/{clubId}/chat/{conversationId}/…`), sinon le préfixe à lister et
 * le filtre des noms à supprimer.
 */
export function chatMediaDeletionTarget(params: {
  clubId: string;
  conversationId: string;
  storagePath: unknown;
}): { prefix: string; matches: (objectName: string) => boolean } | null {
  const path = typeof params.storagePath === "string" ? params.storagePath.trim() : "";
  const root = `clubs/${params.clubId}/chat/${params.conversationId}/`;
  if (!path.startsWith(root) || path.includes("..") || path.includes("//")) return null;
  const lastSlash = path.lastIndexOf("/");
  const fileName = path.slice(lastSlash + 1);
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return null;
  const stem = path.slice(0, lastSlash + 1 + dot);
  const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedStem}(_thumb)?\\.[A-Za-z0-9]+$`);
  return { prefix: stem, matches: (objectName) => pattern.test(objectName) };
}
