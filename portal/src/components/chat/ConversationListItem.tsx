"use client";

import {
  chatDisplayTitle,
  chatStateDocId,
  type ChatConversation,
  type ChatUserState,
} from "@/lib/firebase/chatTypes";
import styles from "./ConversationListItem.module.css";

type ConversationListItemProps = {
  conversation: ChatConversation;
  chatState?: ChatUserState;
  clubName?: string;
  clubColor?: string | null;
  selected?: boolean;
  onSelect: () => void;
};

/** Formate une date relative courte pour la liste. */
function formatListDate(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

/** Tuile conversation pour dock / page messages. */
export function ConversationListItem({
  conversation,
  chatState,
  clubName,
  clubColor,
  selected = false,
  onSelect,
}: ConversationListItemProps) {
  const unread = chatState && !chatState.muted ? chatState.unreadCount : 0;
  const muted = chatState?.muted ?? false;
  const title = chatDisplayTitle(conversation);
  const initial = title.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <button
      type="button"
      className={`${styles.item}${selected ? ` ${styles.itemSelected}` : ""}${unread > 0 ? ` ${styles.itemUnread}` : ""}`}
      onClick={onSelect}
    >
      <span
        className={styles.avatar}
        style={
          clubColor
            ? {
                background: `color-mix(in srgb, ${clubColor.split("+")[0]} 35%, white)`,
                color: clubColor.split("+")[0],
              }
            : undefined
        }
        aria-hidden
      >
        {initial}
      </span>
      <span className={styles.body}>
        <span className={styles.topRow}>
          <span className={styles.title}>{title}</span>
          <span className={styles.date}>
            {formatListDate(conversation.lastMessageAt)}
          </span>
        </span>
        <span className={styles.metaRow}>
          {clubName ? (
            <span className={styles.clubBadge}>{clubName}</span>
          ) : null}
          {muted ? <span className={styles.muteMark}>🔇</span> : null}
        </span>
        <span className={styles.preview}>
          {conversation.lastMessagePreview || "Aucun message"}
        </span>
      </span>
      {unread > 0 ? (
        <span className={styles.unreadBadge} aria-label={`${unread} non lus`}>
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}

export { chatStateDocId };
