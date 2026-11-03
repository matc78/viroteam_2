"use client";

import type {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  RefObject,
} from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { replyPreviewText } from "@/lib/chat/threadMessages";
import type { ChatMessage } from "@/lib/firebase/chatTypes";
import styles from "../ChatThreadView.module.css";

type ComposerProps = {
  draft: string;
  onDraftChange: (draft: string) => void;
  busy: boolean;
  replyTarget: ChatMessage | null;
  onCancelReply: () => void;
  replyAuthorLabel: (senderUid: string | null | undefined) => string;
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
 * Composer du fil : bandeau de citation, menu « + » (photos, sondage),
 * zone de saisie (Entrée envoie, Maj+Entrée saute une ligne) et bouton Envoyer.
 */
export function Composer({
  draft,
  onDraftChange,
  busy,
  replyTarget,
  onCancelReply,
  replyAuthorLabel,
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
  return (
    <form className={styles.composer} onSubmit={(e) => onSend(e)}>
      {replyTarget ? (
        <div className={styles.replyBanner}>
          <div className={styles.replyBannerText}>
            <span className={styles.replyBannerLabel}>Réponse à</span>
            <span className={styles.replyBannerQuote}>
              {replyAuthorLabel(replyTarget.senderUid)} ·{" "}
              {replyPreviewText(replyTarget)}
            </span>
          </div>
          <button
            type="button"
            className={styles.replyBannerClose}
            aria-label="Annuler la réponse"
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
            aria-label="Ajouter"
            aria-expanded={attachOpen}
            aria-haspopup="menu"
            disabled={busy}
            onClick={onToggleAttach}
          >
            <ChatIcon name="plus" size={18} />
          </button>
          {attachOpen ? (
            <div className={styles.attachMenu} role="menu">
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={onPickPhoto}
              >
                <span
                  className={styles.attachIcon}
                  data-tone="photos"
                  aria-hidden
                >
                  <ChatIcon name="image" size={13} />
                </span>
                Photos
              </button>
              {canPoll ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={onCreatePoll}
                >
                  <span
                    className={styles.attachIcon}
                    data-tone="poll"
                    aria-hidden
                  >
                    <ChatIcon name="poll" size={13} />
                  </span>
                  Faire un sondage
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <textarea
          className={styles.input}
          rows={1}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onPaste={onPaste}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Écrire un message…"
          disabled={busy}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={busy || !draft.trim()}
        >
          Envoyer
        </button>
      </div>
    </form>
  );
}
