"use client";

import type {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  RefObject,
} from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import {
  hasSendableText,
  shouldSubmitOnEnter,
} from "@/lib/chat/composerKeys";
import { replyPreviewText } from "@/lib/chat/threadMessages";
import type { ChatMessage } from "@/lib/firebase/chatTypes";
import styles from "../ChatThreadView.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type ComposerProps = {
  draft: string;
  onDraftChange: (draft: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  replyTarget: ChatMessage | null;
  onCancelReply: () => void;
  replyAuthorLabel: (senderUid: string | null | undefined) => string;
  /** Message en cours de modification (bandeau « Modification »). */
  editingMessage: ChatMessage | null;
  savingEdit: boolean;
  onCancelEdit: () => void;
  attachOpen: boolean;
  onToggleAttach: () => void;
  onPickPhoto: () => void;
  canPoll: boolean;
  onCreatePoll: () => void;
  attachWrapRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Input caché du menu « Changer la photo » (rendu ici, dans le formulaire). */
  avatarMenuInputRef: RefObject<HTMLInputElement | null>;
  onAvatarMenuFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onSend: (event?: FormEvent) => void;
};

/**
 * Composer du fil : bandeau de citation ou de modification, menu « + »
 * (photos, sondage), zone de saisie (Entrée valide hors composition IME,
 * Maj+Entrée saute une ligne, Échap annule la modification) et bouton
 * Envoyer / Enregistrer, désactivé tant que le champ est vide.
 */
export function Composer({
  draft,
  onDraftChange,
  inputRef,
  replyTarget,
  onCancelReply,
  replyAuthorLabel,
  editingMessage,
  savingEdit,
  onCancelEdit,
  attachOpen,
  onToggleAttach,
  onPickPhoto,
  canPoll,
  onCreatePoll,
  attachWrapRef,
  fileInputRef,
  onImageChange,
  avatarMenuInputRef,
  onAvatarMenuFileChange,
  onPaste,
  onSend,
}: ComposerProps) {
  const editing = editingMessage != null;
  const canSubmit = hasSendableText(draft) && !savingEdit;
  return (
    <form className={styles.composer} onSubmit={(e) => onSend(e)}>
      {editing ? (
        <div className={styles.replyBanner}>
          <div className={styles.replyBannerText}>
            <span className={styles.replyBannerLabel}>
              {chatCopy.editingBanner}
            </span>
            <span className={styles.replyBannerQuote}>
              {replyPreviewText(editingMessage)}
            </span>
          </div>
          <button
            type="button"
            className={styles.replyBannerClose}
            aria-label={chatCopy.cancelEdit}
            title={chatCopy.cancelEdit}
            onClick={onCancelEdit}
          >
            <ChatIcon name="close" size={14} />
          </button>
        </div>
      ) : replyTarget ? (
        <div className={styles.replyBanner}>
          <div className={styles.replyBannerText}>
            <span className={styles.replyBannerLabel}>{chatCopy.replyTo}</span>
            <span className={styles.replyBannerQuote}>
              {replyAuthorLabel(replyTarget.senderUid)} ·{" "}
              {replyPreviewText(replyTarget)}
            </span>
          </div>
          <button
            type="button"
            className={styles.replyBannerClose}
            aria-label={chatCopy.cancelReply}
            onClick={onCancelReply}
          >
            <ChatIcon name="close" size={14} />
          </button>
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onImageChange}
      />
      <input
        ref={avatarMenuInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onAvatarMenuFileChange}
      />
      <div className={styles.composerRow}>
        <div className={styles.attachWrap} ref={attachWrapRef}>
          <button
            type="button"
            className={`${styles.plusBtn}${attachOpen ? ` ${styles.plusBtnOpen}` : ""}`}
            aria-label={chatCopy.attachAdd}
            aria-expanded={attachOpen}
            aria-haspopup="menu"
            disabled={editing}
            onClick={onToggleAttach}
          >
            <ChatIcon name="plus" size={18} />
          </button>
          {attachOpen ? (
            <div className={styles.attachMenu} role="menu">
              <button type="button" role="menuitem" onClick={onPickPhoto}>
                <span
                  className={styles.attachIcon}
                  data-tone="photos"
                  aria-hidden
                >
                  <ChatIcon name="image" size={13} />
                </span>
                {chatCopy.attachPhotos}
              </button>
              {canPoll ? (
                <button type="button" role="menuitem" onClick={onCreatePoll}>
                  <span
                    className={styles.attachIcon}
                    data-tone="poll"
                    aria-hidden
                  >
                    <ChatIcon name="poll" size={13} />
                  </span>
                  {chatCopy.createPoll}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <textarea
          ref={inputRef}
          className={styles.input}
          rows={1}
          value={draft}
          aria-label={editing ? chatCopy.editMessage : chatCopy.messageHint}
          onChange={(event) => onDraftChange(event.target.value)}
          onPaste={onPaste}
          onKeyDown={(event) => {
            if (editing && event.key === "Escape") {
              event.preventDefault();
              onCancelEdit();
              return;
            }
            if (
              shouldSubmitOnEnter({
                key: event.key,
                shiftKey: event.shiftKey,
                isComposing: event.nativeEvent.isComposing,
                keyCode: event.nativeEvent.keyCode,
              })
            ) {
              event.preventDefault();
              if (canSubmit) onSend();
            }
          }}
          placeholder={chatCopy.messageHint}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!canSubmit}
          // Garde le focus dans le champ au clic (la saisie continue).
          onMouseDown={(event) => event.preventDefault()}
        >
          {editing ? chatCopy.save : chatCopy.send}
        </button>
      </div>
    </form>
  );
}
