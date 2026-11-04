"use client";

import type { ReactNode } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { ConversationAvatar } from "@/components/chat/ConversationAvatar";
import { useMenuA11y } from "@/lib/ui/useMenuA11y";
import type { ChatConversation } from "@/lib/firebase/chatTypes";
import styles from "../ChatThreadView.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type ThreadHeaderProps = {
  /** Conversation (avatar) ; null tant qu’elle n’est pas chargée. */
  conversation: ChatConversation | null;
  clubColor?: string | null;
  /** Titre complet, tronqué en CSS (ellipse) si trop long. */
  title: string;
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
  /** Ferme le menu Options (Escape, Tab, clic extérieur). */
  onCloseMenu: () => void;
  /** Retour à la liste (portail mobile, fil en plein écran). */
  onBack?: () => void;
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
 * En-tête du fil : avatar + titre (ouvre les infos), aperçu des membres,
 * menu Options, boutons Agrandir / Fermer.
 */
export function ThreadHeader({
  conversation,
  clubColor,
  title,
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
  onCloseMenu,
  onBack,
  onOpenInfo,
  onOpenSearch,
  onToggleMute,
  onToggleFavorite,
  onChangeAvatar,
  onCreatePoll,
  onMaximize,
  onClose,
}: ThreadHeaderProps) {
  const menu = useMenuA11y({ open: menuOpen, onClose: onCloseMenu });
  return (
    <header className={styles.header}>
      {onBack ? (
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={chatCopy.backToInbox}
          onClick={onBack}
        >
          <ChatIcon name="chevronLeft" size={20} />
        </button>
      ) : null}
      <button
        type="button"
        className={styles.headerMain}
        onClick={() => onOpenInfo()}
        aria-label={chatCopy.conversationInfo}
      >
        {conversation ? (
          <ConversationAvatar
            conversation={conversation}
            title={title}
            clubColor={clubColor}
            size="header"
          />
        ) : (
          <span className={styles.headerAvatarPlaceholder} aria-hidden />
        )}
        <span className={styles.headerText}>
          <span className={styles.titleRow}>
            <span className={styles.title} title={title}>
              {title}
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
        <div className={styles.menuWrap} ref={menu.wrapRef}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={chatCopy.threadOptions}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={onToggleMenu}
          >
            <ChatIcon name="options" size={18} />
          </button>
          {menuOpen ? (
            <div
              ref={menu.menuRef}
              className={styles.menu}
              role="menu"
              aria-label={chatCopy.threadOptions}
            >
              <button type="button" role="menuitem" onClick={() => onOpenInfo()}>
                <ChatIcon name="info" size={18} />
                {chatCopy.conversationInfo}
              </button>
              <button type="button" role="menuitem" onClick={onOpenSearch}>
                <ChatIcon name="search" size={18} />
                {chatCopy.searchMessage}
              </button>
              <button type="button" role="menuitem" onClick={onToggleMute}>
                <ChatIcon name={muted ? "bell" : "mute"} size={18} />
                {muted ? chatCopy.unmute : chatCopy.mute}
              </button>
              <button type="button" role="menuitem" onClick={onToggleFavorite}>
                <ChatIcon
                  name={favorite ? "favoriteFill" : "favorite"}
                  size={18}
                />
                {favorite ? chatCopy.removeFavorite : chatCopy.addFavorite}
              </button>
              {isGroup ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onOpenInfo({ rename: true })}
                >
                  <ChatIcon name="edit" size={18} />
                  {chatCopy.renameConversation}
                </button>
              ) : null}
              {canChangeGroupAvatar ? (
                <button type="button" role="menuitem" onClick={onChangeAvatar}>
                  <ChatIcon name="image" size={18} />
                  {chatCopy.changeGroupAvatar}
                </button>
              ) : null}
              {canPoll ? (
                <button type="button" role="menuitem" onClick={onCreatePoll}>
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
