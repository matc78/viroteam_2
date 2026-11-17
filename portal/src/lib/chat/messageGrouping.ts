import { isSameCalendarDay } from "@/lib/chat/formatChatDateSeparator";
import { ChatMessageTypes } from "@/lib/firebase/constants";
import {
  isChatMessageDeleted,
  type ChatMessage,
} from "@/lib/firebase/chatTypes";

/** Écart maximal entre deux messages d’un même groupe (identique à l’app). */
export const MESSAGE_GROUP_MAX_GAP_MS = 5 * 60 * 1000;

/** Message qui reste toujours isolé (supprimé ou sondage). */
function isUngroupable(message: ChatMessage): boolean {
  return (
    isChatMessageDeleted(message) || message.type === ChatMessageTypes.poll
  );
}

/**
 * True si `next` (qui suit directement `previous` sans séparateur) appartient
 * au même groupe : même expéditeur, même jour local, moins de 5 minutes
 * d’écart, aucun des deux supprimé ni sondage.
 * La condition « aucun séparateur entre eux » est vérifiée par l’appelant.
 */
export function canGroupMessages(
  previous: ChatMessage,
  next: ChatMessage,
): boolean {
  if (previous.senderUid !== next.senderUid) return false;
  if (isUngroupable(previous) || isUngroupable(next)) return false;
  if (!isSameCalendarDay(previous.createdAt, next.createdAt)) return false;
  const gap = next.createdAt.getTime() - previous.createdAt.getTime();
  return gap >= 0 && gap < MESSAGE_GROUP_MAX_GAP_MS;
}
