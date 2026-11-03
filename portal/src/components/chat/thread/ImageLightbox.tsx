"use client";

import type { RefObject } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import styles from "../ChatThreadView.module.css";

type ImageLightboxProps = {
  overlayRef: RefObject<HTMLDivElement | null>;
  url: string;
  onClose: () => void;
};

/** Photo du fil en plein écran (clic hors image ou bouton pour fermer). */
export function ImageLightbox({ overlayRef, url, onClose }: ImageLightboxProps) {
  return (
    <div
      ref={overlayRef}
      className={styles.lightbox}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo en plein écran"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Photo en plein écran"
        className={styles.lightboxImage}
        onClick={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        className={styles.lightboxClose}
        aria-label="Fermer"
        onClick={onClose}
      >
        <ChatIcon name="close" size={20} />
      </button>
    </div>
  );
}
