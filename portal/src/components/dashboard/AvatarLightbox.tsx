"use client";

import { useEffect } from "react";
import styles from "./AvatarLightbox.module.css";

type AvatarLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

/** Overlay plein écran pour zoomer une photo de profil. */
export function AvatarLightbox({ src, alt, onClose }: AvatarLightboxProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Fermer"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.image}
        src={src}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
