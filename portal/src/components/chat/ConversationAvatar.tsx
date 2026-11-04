"use client";

import type { CSSProperties } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { splitBrandColorHex } from "@/lib/clubSetup/clubBrandColors";
import { ClubSetupDefaults } from "@/lib/clubSetup/constants";
import {
  conversationGroupAvatarTone,
  isChannelConversation,
  isGroupConversation,
  type ChatConversation,
} from "@/lib/firebase/chatTypes";
import styles from "./ConversationAvatar.module.css";

type ConversationAvatarProps = {
  conversation: ChatConversation;
  /** Titre affiché (initiale d’un DM). */
  title: string;
  clubColor?: string | null;
  /** Gabarit : tuile d’inbox (`--chat-avatar-inbox`) ou en-tête du fil. */
  size: "inbox" | "header";
  /** Clic sur la photo de groupe (zoom) ; sans effet sur les autres avatars. */
  onPhotoClick?: () => void;
};

/**
 * Avatar d’une conversation : mégaphone (canal), photo ou icône de groupe
 * (teinte équipe / parents / groupe), initiale du DM teintée couleur club.
 * Décoratif (`aria-hidden`) : le titre voisin porte le nom.
 */
export function ConversationAvatar({
  conversation,
  title,
  clubColor,
  size,
  onPhotoClick,
}: ConversationAvatarProps) {
  const sizeClass = size === "header" ? styles.header : styles.inbox;
  const isGroup = isGroupConversation(conversation);
  const isChannel = isChannelConversation(conversation);
  const groupAvatarUrl =
    isGroup && !isChannel ? conversation.avatarUrl?.trim() || null : null;

  if (isChannel) {
    return (
      <span
        className={`${styles.avatar} ${sizeClass} ${styles.channel}`}
        aria-hidden
      >
        <ChatIcon name="megaphone" size={size === "header" ? 16 : 20} />
      </span>
    );
  }

  if (groupAvatarUrl) {
    return (
      <span
        className={`${styles.avatar} ${sizeClass} ${styles.photo}${onPhotoClick ? ` ${styles.zoomable}` : ""}`}
        aria-hidden
        onClick={
          onPhotoClick
            ? (event) => {
                event.stopPropagation();
                onPhotoClick();
              }
            : undefined
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={groupAvatarUrl} alt="" />
      </span>
    );
  }

  if (isGroup) {
    const tone = conversationGroupAvatarTone(conversation);
    const toneClass =
      tone === "team"
        ? styles.team
        : tone === "parents"
          ? styles.parents
          : styles.group;
    return (
      <span className={`${styles.avatar} ${sizeClass} ${toneClass}`} aria-hidden>
        <ChatIcon name="usersThree" size={size === "header" ? 16 : 20} />
      </span>
    );
  }

  const brand = splitBrandColorHex(
    clubColor ?? ClubSetupDefaults.brandColorHex,
  ).primary;
  return (
    <span
      className={`${styles.avatar} ${sizeClass}`}
      style={
        {
          background: `color-mix(in srgb, ${brand} 35%, var(--color-surface-card))`,
          color: brand,
        } as CSSProperties
      }
      aria-hidden
    >
      {title.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
