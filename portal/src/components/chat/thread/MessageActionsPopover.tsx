"use client";

import type { CSSProperties, RefObject } from "react";
import { createPortal } from "react-dom";
import type { AnchoredPopoverLayout } from "@/components/chat/anchoredPopover";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { ReactionQuickBar } from "@/components/chat/MessageReactions";
import { ChatMessageTypes } from "@/lib/firebase/constants";
import type { ChatMessage } from "@/lib/firebase/chatTypes";
import styles from "../ChatThreadView.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type MessageActionsPopoverProps = {
  message: ChatMessage;
  /** `null` tant que la position n’est pas calculée : overlay seul. */
  layout: AnchoredPopoverLayout | null;
  overlayRef: RefObject<HTMLDivElement | null>;
  viewerUid: string | undefined;
  canWrite: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * Popover d’actions d’un message (portail dans `body`), ancré sur la bulle :
 * réactions rapides puis Répondre / Copier / Modifier / Supprimer.
 */
export function MessageActionsPopover({
  message,
  layout,
  overlayRef,
  viewerUid,
  canWrite,
  onClose,
  onReaction,
  onReply,
  onCopy,
  onEdit,
  onDelete,
}: MessageActionsPopoverProps) {
  const mine = viewerUid === message.senderUid;
  return createPortal(
    <div
      ref={overlayRef}
      className={styles.actionOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={chatCopy.messageActions}
    >
      {layout ? (
        <div
          className={`${styles.actionStack}${
            layout.placement === "above" ? ` ${styles.actionStackAbove}` : ""
          }`}
          style={
            {
              left: layout.left,
              top: layout.top,
              width: layout.width,
              maxHeight: layout.maxHeight,
              alignItems: mine ? "flex-end" : "flex-start",
            } satisfies CSSProperties
          }
          onClick={(event) => event.stopPropagation()}
        >
          <ReactionQuickBar onPick={onReaction} />
          <div className={styles.actionSheet}>
            {canWrite ? (
              <button
                type="button"
                className={styles.actionItem}
                onClick={onReply}
              >
                <ChatIcon name="reply" size={18} />
                {chatCopy.reply}
              </button>
            ) : null}
            {message.type === ChatMessageTypes.text &&
            (message.text ?? "").trim() ? (
              <button
                type="button"
                className={styles.actionItem}
                onClick={onCopy}
              >
                <ChatIcon name="copy" size={18} />
                {chatCopy.copyMessage}
              </button>
            ) : null}
            {mine && message.type === ChatMessageTypes.text ? (
              <button
                type="button"
                className={styles.actionItem}
                onClick={onEdit}
              >
                <ChatIcon name="edit" size={18} />
                {chatCopy.editMessage}
              </button>
            ) : null}
            {mine ? (
              <button
                type="button"
                className={`${styles.actionItem} ${styles.actionDanger}`}
                onClick={onDelete}
              >
                <ChatIcon name="trash" size={18} />
                {chatCopy.deleteMessage}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
