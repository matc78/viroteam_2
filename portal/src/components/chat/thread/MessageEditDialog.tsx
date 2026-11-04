"use client";

import type { RefObject } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import styles from "../ChatThreadView.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type MessageEditDialogProps = {
  overlayRef: RefObject<HTMLDivElement | null>;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSave: () => void;
  onClose: () => void;
};

/** Dialog de modification d’un message texte. */
export function MessageEditDialog({
  overlayRef,
  draft,
  onDraftChange,
  onSave,
  onClose,
}: MessageEditDialogProps) {
  return (
    <div
      ref={overlayRef}
      className={styles.editOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={chatCopy.editMessageDialog}
    >
      <div
        className={styles.actionSheet}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.editFieldWrap}>
          <textarea
            className={styles.editField}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={4}
            autoFocus
          />
        </div>
        <button type="button" className={styles.actionItem} onClick={onSave}>
          <ChatIcon name="edit" size={18} />
          {chatCopy.save}
        </button>
        <button type="button" className={styles.actionItem} onClick={onClose}>
          {chatCopy.cancel}
        </button>
      </div>
    </div>
  );
}
