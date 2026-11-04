"use client";

import { useState, type ReactNode } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { ClubBadge } from "@/components/chat/ClubBadge";
import { ConversationAvatar } from "@/components/chat/ConversationAvatar";
import { AvatarLightbox } from "@/components/dashboard/AvatarLightbox";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import {
  resolveConversationPreviewSender,
  type ChatPreviewSender,
} from "@/lib/chat/conversationPreview";
import {
  chatDisplayTitle,
  chatStateDocId,
  isChannelConversation,
  isGroupConversation,
  type ChatConversation,
  type ChatUserState,
} from "@/lib/firebase/chatTypes";
import { effectiveUnreadCount } from "@/lib/chat/conversationUnread";
import { useAuth } from "@/lib/firebase/AuthProvider";
import styles from "./ConversationListItem.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

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
  const isGroup = isGroupConversation(conversation);
  const isChannel = isChannelConversation(conversation);
  const groupAvatarUrl =
    isGroup && !isChannel ? conversation.avatarUrl?.trim() || null : null;
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);
  const previewSender = resolveConversationPreviewSender(
    conversation,
    previewSenderByKey,
  );
  const previewText = conversation.lastMessagePreview.trim();
  const unreadPreviewLabel = chatCopy.unreadPreview(unread);

  let previewContent: ReactNode;
  if (unread > 0) {
    previewContent = unreadPreviewLabel;
  } else if (!previewText) {
    previewContent = (
      <span className={styles.previewEmpty}>{chatCopy.emptyPreview}</span>
    );
  } else if (isGroup && previewSender) {
    previewContent = (
      <>
        <span className={styles.previewName}>{previewSender.firstName}</span>
        <span className={styles.previewArrow} aria-hidden>
          <ChatIcon name="previewArrow" size={11} />
        </span>
        <span className={styles.previewMessage}>{previewText}</span>
      </>
    );
  } else {
    previewContent = (
      <span className={styles.previewMessage}>{previewText}</span>
    );
  }

  return (
    <>
    <button
      type="button"
      className={[
        styles.item,
        selected ? styles.itemSelected : "",
        unread > 0 ? styles.itemUnread : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
    >
      <ConversationAvatar
        conversation={conversation}
        title={title}
        clubColor={clubColor}
        size="inbox"
        onPhotoClick={
          groupAvatarUrl ? () => setPhotoLightboxOpen(true) : undefined
        }
      />
      <span className={styles.body}>
        <span className={styles.topRow}>
          <span className={styles.title}>
            {favorite ? (
              <span className={styles.favMark} aria-label={chatCopy.favoriteMark}>
                <ChatIcon name="favoriteFill" size={12} />
              </span>
            ) : null}
            {title}
          </span>
          {clubName ? (
            <ClubBadge
              name={clubName}
              color={clubColor}
              className={styles.clubBadge}
            />
          ) : null}
          {clubRole ? (
            <RoleBadge role={clubRole} size="sm" iconOnly />
          ) : null}
          {muted ? (
            <span className={styles.muteMark} aria-label={chatCopy.mutedNotifications}>
              <ChatIcon name="mute" size={12} />
            </span>
          ) : null}
          <span className={styles.date}>
            {formatListDate(conversation.lastMessageAt)}
          </span>
        </span>
        <span className={styles.preview}>{previewContent}</span>
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
    {photoLightboxOpen && groupAvatarUrl ? (
      <AvatarLightbox
        src={groupAvatarUrl}
        alt={chatCopy.photoOfAlt(title)}
        onClose={() => setPhotoLightboxOpen(false)}
      />
    ) : null}
    </>
  );
}

export { chatStateDocId };
