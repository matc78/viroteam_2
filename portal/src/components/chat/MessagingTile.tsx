"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

/** True si la route courante est la page Messagerie (bureau ou famille). */
function isMessagesPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/family/messages" ||
    pathname.startsWith("/family/messages/")
  );
}

/**
 * Bouton header Messagerie : navigue vers la page messagerie.
 * Actif sur la page Messagerie (comme « Mon planning » sur sa route).
 * Badge non-lus si > 0.
 */
export function MessagingTile() {
  const pathname = usePathname();
  const { totalUnread, messagesHref } = useChat();
  const isActive = isMessagesPath(pathname);
  const label =
    totalUnread > 0
      ? `Messagerie, ${totalUnread} non lu${totalUnread > 1 ? "s" : ""}`
      : "Messagerie";

  return (
    <Link
      href={messagesHref}
      scroll={false}
      prefetch
      className={`${styles.tile}${isActive ? ` ${styles.tileActive}` : ""}`}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
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
    </Link>
  );
}
