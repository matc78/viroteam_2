import type { ChatConversation } from "@/lib/firebase/chatTypes";
import { MemberRoles, PortalUiRoles } from "@/lib/firebase/constants";

/** Infos expéditeur pour la preview inbox. */
export type ChatPreviewSender = {
  firstName: string;
  role: string;
};

/** Clé d’annuaire expéditeur `clubId:uid`. */
export function previewSenderKey(clubId: string, uid: string): string {
  return `${clubId}:${uid}`;
}

/** Normalise un rôle pour la couleur de flèche preview. */
export function previewSenderRoleTone(role: string | null | undefined): string {
  if (role === MemberRoles.admin) return MemberRoles.admin;
  if (role === MemberRoles.coach) return MemberRoles.coach;
  if (role === PortalUiRoles.parent) return PortalUiRoles.parent;
  return MemberRoles.player;
}

/**
 * Résout prénom + rôle pour la preview d’une conversation
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
