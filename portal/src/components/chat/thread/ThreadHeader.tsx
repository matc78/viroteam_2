"use client";

import type { ReactNode } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import styles from "../ChatThreadView.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type ThreadHeaderProps = {
  title: string;
  titleShort: string;
  favorite: boolean;
  muted: boolean;
  headerExtra?: ReactNode;
  /** Ligne « membres » réservée (même vide) dès qu’il y a des participants. */
  showMembersPreviewSlot: boolean;
  membersPreview: string;
  isGroup: boolean;
  canChangeGroupAvatar: boolean;
  canPoll: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpenInfo: (options?: { rename?: boolean }) => void;
  onOpenSearch: () => void;
  onToggleMute: () => void;
  onToggleFavorite: () => void;
  onChangeAvatar: () => void;
  onCreatePoll: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
};

/**
 * En-tête du fil : titre (ouvre les infos), aperçu des membres,
 * menu Options, boutons Agrandir / Fermer.
 */
export function ThreadHeader({
  title,
  titleShort,
  favorite,
  muted,
  headerExtra,
  showMembersPreviewSlot,
  membersPreview,
  isGroup,
  canChangeGroupAvatar,
  canPoll,
  menuOpen,
  onToggleMenu,
  onOpenInfo,
  onOpenSearch,
  onToggleMute,
  onToggleFavorite,
  onChangeAvatar,
  onCreatePoll,
  onMaximize,
  onClose,
}: ThreadHeaderProps) {
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.headerMain}
        onClick={() => onOpenInfo()}
        aria-label={chatCopy.conversationInfo}
      >
        <span className={styles.headerText}>
          <span className={styles.titleRow}>
            <span className={styles.title} title={title}>
              {titleShort}
            </span>
            {favorite ? (
              <span className={styles.favMark} aria-label={chatCopy.favoriteMark}>
                <ChatIcon name="favoriteFill" size={12} />
              </span>
            ) : null}
            {headerExtra ? (
              <span className={styles.headerClubSlot}>{headerExtra}</span>
            ) : null}
          </span>
          {showMembersPreviewSlot ? (
            <span className={styles.membersPreview}>
              {membersPreview || " "}
            </span>
          ) : null}
        </span>
      </button>
      <div className={styles.headerActions}>
        <div className={styles.menuWrap}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={chatCopy.threadOptions}
            onClick={onToggleMenu}
          >
            <ChatIcon name="options" size={18} />
          </button>
          {menuOpen ? (
            <div className={styles.menu}>
              <button type="button" onClick={() => onOpenInfo()}>
                <ChatIcon name="info" size={18} />
                {chatCopy.conversationInfo}
              </button>
              <button type="button" onClick={onOpenSearch}>
                <ChatIcon name="search" size={18} />
                {chatCopy.searchMessage}
              </button>
              <button type="button" onClick={onToggleMute}>
                <ChatIcon name={muted ? "bell" : "mute"} size={18} />
                {muted ? chatCopy.unmute : chatCopy.mute}
              </button>
              <button type="button" onClick={onToggleFavorite}>
                <ChatIcon
                  name={favorite ? "favoriteFill" : "favorite"}
                  size={18}
                />
                {favorite ? chatCopy.removeFavorite : chatCopy.addFavorite}
              </button>
              {isGroup ? (
                <button
                  type="button"
                  onClick={() => onOpenInfo({ rename: true })}
                >
                  <ChatIcon name="edit" size={18} />
                  {chatCopy.renameConversation}
                </button>
              ) : null}
              {canChangeGroupAvatar ? (
                <button type="button" onClick={onChangeAvatar}>
                  <ChatIcon name="image" size={18} />
                  {chatCopy.changeGroupAvatar}
                </button>
              ) : null}
              {canPoll ? (
                <button type="button" onClick={onCreatePoll}>
                  <ChatIcon name="poll" size={18} />
                  {chatCopy.createPoll}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {onMaximize ? (
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={chatCopy.maximize}
            onClick={onMaximize}
          >
            <ChatIcon name="maximize" size={16} />
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={chatCopy.close}
            onClick={onClose}
          >
            <ChatIcon name="close" size={16} />
          </button>
        ) : null}
      </div>
    </header>
  );
}
