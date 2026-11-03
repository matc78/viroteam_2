import { effectiveUnreadCount } from "@/lib/chat/conversationUnread";
import {
  formatChatDateSeparator,
  isSameCalendarDay,
} from "@/lib/chat/formatChatDateSeparator";
import type {
  ChatConversation,
  ChatMessage,
  ChatUserState,
} from "@/lib/firebase/chatTypes";

/** Ligne du fil : séparateur de jour, séparateur « nouveau » ou message. */
export type ThreadRow =
  | { kind: "date"; id: string; label: string }
  | { kind: "unread"; id: string }
  | { kind: "message"; id: string; message: ChatMessage };

/**
 * Ancre du séparateur « nouveau », figée à l’ouverture du fil (avant markRead) :
 * N derniers messages (`count`) ou messages d’un autre après `afterMs`.
 */
export type UnreadSeparatorAnchor =
  | { kind: "count"; count: number }
  | { kind: "after"; afterMs: number }
  | null;

/**
 * Calcule l’ancre du séparateur « nouveau » à l’ouverture d’un fil.
 * Sans conversation connue : compteur Firestore (sauf muet).
 * Priorité au compteur Firestore, sinon `lastReadAt`, sinon compteur effectif.
 */
export function resolveUnreadSeparatorAnchor(params: {
  conversation: ChatConversation | null;
  chatState?: ChatUserState;
  viewerUid?: string | null;
}): UnreadSeparatorAnchor {
  const { conversation, chatState, viewerUid } = params;
  const effective = conversation
    ? effectiveUnreadCount({ conversation, chatState, viewerUid })
    : chatState && !chatState.muted
      ? chatState.unreadCount
      : 0;

  if (effective <= 0) return null;
  if (chatState && chatState.unreadCount > 0) {
    return { kind: "count", count: chatState.unreadCount };
  }
  if (chatState?.lastReadAt) {
    return { kind: "after", afterMs: chatState.lastReadAt.getTime() };
  }
  return { kind: "count", count: effective };
}

/**
 * Clé `AAAA-MM-JJ` du jour calendaire local : alignée sur le regroupement
 * (`isSameCalendarDay`), contrairement à `toISOString()` (jour UTC) qui
 * donnait la même clé à deux jours locaux autour de minuit.
 */
function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Construit les lignes du fil à partir des messages triés (plus ancien en tête) :
 * un séparateur par jour calendaire, et au plus un séparateur « nouveau »
 * avant le premier message non lu selon l’ancre.
 */
export function buildThreadRows(params: {
  messages: ChatMessage[];
  anchor: UnreadSeparatorAnchor;
  viewerUid?: string | null;
}): ThreadRow[] {
  const { messages, anchor, viewerUid } = params;
  const rows: ThreadRow[] = [];
  let previousDay: Date | null = null;
  const firstUnreadByCount =
    anchor?.kind === "count" && anchor.count > 0 && messages.length > 0
      ? Math.max(0, messages.length - anchor.count)
      : null;
  let unreadInserted = false;
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index]!;
    if (!previousDay || !isSameCalendarDay(previousDay, message.createdAt)) {
      rows.push({
        kind: "date",
        id: `date-${localDayKey(message.createdAt)}`,
        label: formatChatDateSeparator(message.createdAt),
      });
      previousDay = message.createdAt;
    }
    const showUnreadHere =
      !unreadInserted &&
      ((firstUnreadByCount !== null && index === firstUnreadByCount) ||
        (anchor?.kind === "after" &&
          message.createdAt.getTime() > anchor.afterMs &&
          message.senderUid !== viewerUid));
    if (showUnreadHere) {
      rows.push({ kind: "unread", id: "unread-separator" });
      unreadInserted = true;
    }
    rows.push({ kind: "message", id: message.id, message });
  }
  return rows;
}
