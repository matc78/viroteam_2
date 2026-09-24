"use client";

import type { CSSProperties } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import {
  previewSenderRoleTone,
  resolveConversationPreviewSender,
  type ChatPreviewSender,
} from "@/lib/chat/conversationPreview";
import {
  readableTextOnBrand,
  splitBrandColorHex,
} from "@/lib/clubSetup/clubBrandColors";
import { ClubSetupDefaults } from "@/lib/clubSetup/constants";
import {
  chatDisplayTitle,
  chatStateDocId,
  type ChatConversation,
  type ChatUserState,
} from "@/lib/firebase/chatTypes";
import { effectiveUnreadCount } from "@/lib/chat/conversationUnread";
import { useAuth } from "@/lib/firebase/AuthProvider";
import styles from "./ConversationListItem.module.css";

type ConversationListItemProps = {
  conversation: ChatConversation;
  chatState?: ChatUserState;
  clubName?: string;
  clubColor?: string | null;
  /** Rôle de l’utilisateur dans le club de cette discussion. */
  clubRole?: string | null;
  /** Annuaire fallback `clubId:uid` → prénom + rôle. */
  previewSenderByKey?: Record<string, ChatPreviewSender>;
  /** Nom du pair résolu pour un DM (évite d’afficher son propre nom). */
  peerDisplayName?: string | null;
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
  clubRole,
  previewSenderByKey,
  peerDisplayName,
  selected = false,
  onSelect,
}: ConversationListItemProps) {
  const { user } = useAuth();
  const unread = effectiveUnreadCount({
    conversation,
    chatState,
    viewerUid: user?.uid,
  });
  const muted = chatState?.muted ?? false;
  const favorite = chatState?.favorite ?? false;
  const title = chatDisplayTitle(conversation, { peerDisplayName });
  const initial = title.trim().slice(0, 1).toUpperCase() || "?";
  const brand = splitBrandColorHex(
    clubColor ?? ClubSetupDefaults.brandColorHex,
  ).primary;
  const brandText = readableTextOnBrand(brand);
  const previewSender = resolveConversationPreviewSender(
    conversation,
    previewSenderByKey,
  );
  const previewText = conversation.lastMessagePreview.trim();
  const arrowRole = previewSenderRoleTone(previewSender?.role);
  const unreadPreviewLabel =
    unread <= 1 ? `${unread} nouveau message` : `${unread} nouveaux messages`;

  return (
    <button
      type="button"
      className={`${styles.item}${selected ? ` ${styles.itemSelected}` : ""}${unread > 0 ? ` ${styles.itemUnread}` : ""}`}
      onClick={onSelect}
    >
      <span
        className={styles.avatar}
        style={
          {
            background: `color-mix(in srgb, ${brand} 35%, white)`,
            color: brand,
          } as CSSProperties
        }
        aria-hidden
      >
        {initial}
      </span>
      <span className={styles.body}>
        <span className={styles.topRow}>
          <span className={styles.title}>
            {favorite ? (
              <span className={styles.favMark} aria-label="Favori">
                <ChatIcon name="favoriteFill" size={12} />
              </span>
            ) : null}
            {title}
          </span>
          <span className={styles.date}>
            {formatListDate(conversation.lastMessageAt)}
          </span>
        </span>
        <span className={styles.metaRow}>
          {clubName ? (
            <span
              className={styles.clubBadge}
              style={
                {
                  "--club-brand": brand,
                  "--club-brand-text": brandText,
                } as CSSProperties
              }
            >
              {clubName}
            </span>
          ) : null}
          {clubRole ? (
            <RoleBadge role={clubRole} size="sm" iconOnly />
          ) : null}
          {muted ? (
            <span className={styles.muteMark} aria-label="Notifications coupées">
              <ChatIcon name="mute" size={12} />
            </span>
          ) : null}
        </span>
        <span className={styles.preview}>
          {unread > 0 ? (
            unreadPreviewLabel
          ) : previewText ? (
            previewSender ? (
              <>
                <span className={styles.previewName}>
                  {previewSender.firstName}
                </span>{" "}
                <span
                  className={styles.previewArrow}
                  data-role={arrowRole}
                  aria-hidden
                >
                  →
                </span>{" "}
                <span className={styles.previewMessage}>{previewText}</span>
              </>
            ) : (
              previewText
            )
          ) : (
            "Aucun message"
          )}
        </span>
      </span>
      {unread > 0 ? (
        <span
          className={styles.unreadBadge}
          aria-label={unreadPreviewLabel}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}

export { chatStateDocId };
