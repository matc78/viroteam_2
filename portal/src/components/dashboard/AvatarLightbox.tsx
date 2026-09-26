"use client";

import { useEffect } from "react";
import styles from "./AvatarLightbox.module.css";

type AvatarLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
  /** Si fourni, affiche un bouton « Modifier ». */
  onEdit?: () => void;
  editLabel?: string;
  shape?: "circle" | "rounded";
};

/** Overlay plein écran pour zoomer une photo (profil, logo, groupe). */
export function AvatarLightbox({
  src,
  alt,
  onClose,
  onEdit,
  editLabel = "Modifier",
  shape = "circle",
}: AvatarLightboxProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const imageClass =
    shape === "rounded"
      ? `${styles.image} ${styles.rounded}`
      : styles.image;

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
        className={imageClass}
        src={src}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
      />
      {onEdit ? (
        <button
          type="button"
          className={styles.edit}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
            onEdit();
          }}
        >
          {editLabel}
        </button>
      ) : null}
    </div>
  );
}
