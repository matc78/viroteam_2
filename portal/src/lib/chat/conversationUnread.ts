import type { ChatConversation, ChatUserState } from "@/lib/firebase/chatTypes";

/**
 * Compteur non-lus affiché dans l’inbox.
 *
 * Priorité à `unreadCount` Firestore. Fallback si le trigger a sauté
 * l’incrément (fenêtre « lecture active ») ou si aucun chatState n’existe
 * encore : dernier message d’un autre après `lastReadAt` (ou jamais lu).
 */
export function effectiveUnreadCount(params: {
  conversation: ChatConversation;
  chatState?: ChatUserState;
  viewerUid?: string | null;
}): number {
  const { conversation, chatState, viewerUid } = params;
  if (chatState?.muted) return 0;
  if (chatState && chatState.unreadCount > 0) return chatState.unreadCount;

  const lastAt = conversation.lastMessageAt?.getTime() ?? 0;
  const lastSender = conversation.lastSenderUid?.trim() || "";
  if (!lastAt || !lastSender) return 0;
  if (viewerUid && lastSender === viewerUid) return 0;

  const readAt = chatState?.lastReadAt?.getTime() ?? 0;
  if (readAt <= 0) return 1;
  if (lastAt > readAt) return 1;
  return 0;
}
