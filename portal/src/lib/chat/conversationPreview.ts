import type { ChatConversation } from "@/lib/firebase/chatTypes";
import { toDisplayBadge } from "@/lib/auth/permissions";

/** Infos expéditeur pour la preview inbox. */
export type ChatPreviewSender = {
  firstName: string;
  role: string;
};

/** Clé d’annuaire expéditeur `clubId:uid`. */
export function previewSenderKey(clubId: string, uid: string): string {
  return `${clubId}:${uid}`;
}

/** Normalise un badge pour la couleur de flèche preview (inconnu → membre). */
export function previewSenderRoleTone(role: string | null | undefined): string {
  return toDisplayBadge(role);
}

/**
 * Résout prénom + badge pour la preview d’une conversation
 * (champs persistés, sinon annuaire membres).
 */
export function resolveConversationPreviewSender(
  conversation: ChatConversation,
  directory?: Record<string, ChatPreviewSender>,
): ChatPreviewSender | null {
  const persistedName = conversation.lastSenderFirstName?.trim() ?? "";
  const persistedRole = conversation.lastSenderRole?.trim() ?? "";
  if (persistedName) {
    return {
      firstName: persistedName,
      role: previewSenderRoleTone(persistedRole || undefined),
    };
  }

  const uid = conversation.lastSenderUid;
  if (!uid || !directory) return null;
  const fromDir = directory[previewSenderKey(conversation.clubId, uid)];
  if (!fromDir?.firstName.trim()) return null;
  return {
    firstName: fromDir.firstName.trim(),
    role: previewSenderRoleTone(fromDir.role || persistedRole || undefined),
  };
}
