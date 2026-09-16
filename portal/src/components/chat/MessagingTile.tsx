"use client";

import { useChat } from "@/lib/chat/ChatProvider";
import styles from "./MessagingTile.module.css";

/** Icône bulle messagerie. */
function ChatIcon() {
  return (
    <svg
      className={styles.iconSvg}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5A2.25 2.25 0 0 1 19.5 6.75v7.5A2.25 2.25 0 0 1 17.25 16.5H9.3L5.1 19.35a.75.75 0 0 1-1.2-.6V6.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Bouton header Messagerie : ouvre le dock (pas de navigation).
 * Badge non-lus si > 0.
 */
export function MessagingTile() {
  const { dockOpen, totalUnread, toggleDock } = useChat();
  const label =
    totalUnread > 0
      ? `Messagerie, ${totalUnread} non lu${totalUnread > 1 ? "s" : ""}`
      : "Messagerie";

  return (
    <button
      type="button"
      className={`${styles.tile}${dockOpen ? ` ${styles.tileActive}` : ""}`}
      aria-label={label}
      aria-pressed={dockOpen}
      onClick={toggleDock}
    >
      <span className={styles.icon}>
        <ChatIcon />
        {totalUnread > 0 ? (
          <span className={styles.badge} aria-hidden>
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        ) : null}
      </span>
      <span className={styles.label}>Messagerie</span>
    </button>
  );
}
