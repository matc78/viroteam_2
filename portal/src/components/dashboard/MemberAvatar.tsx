"use client";

import { useState } from "react";
import { AvatarLightbox } from "./AvatarLightbox";
import styles from "./MemberAvatar.module.css";

type MemberAvatarProps = {
  displayName: string;
  avatarUrl?: string | null;
  hasLinkedAccount: boolean;
  size?: "xs" | "sm" | "md";
  /** Fond initiales : défaut (bleu) ou blanc cassé. */
  tone?: "default" | "offwhite";
};

/** Avatar membre (photo / initiales / icône), zoom au clic si photo. */
export function MemberAvatar({
  displayName,
  avatarUrl,
  hasLinkedAccount,
  size = "md",
  tone = "default",
}: MemberAvatarProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const photoUrl = avatarUrl?.trim() || null;
  const canZoom = hasLinkedAccount && Boolean(photoUrl);
  const initials = memberInitials(displayName);

  const avatar = (
    <span
      className={`${styles.avatar} ${styles[size]}${tone === "offwhite" ? ` ${styles.offwhite}` : ""}${canZoom ? ` ${styles.clickable}` : ""}`}
      aria-hidden={!canZoom}
    >
      {canZoom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.photo} src={photoUrl!} alt="" />
      ) : hasLinkedAccount ? (
        <span className={styles.initials}>{initials}</span>
      ) : (
        <span className={styles.icon} aria-hidden>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            fill="currentColor"
          >
            <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM74.08,197.5a64,64,0,0,1,107.84,0,87.83,87.83,0,0,1-107.84,0ZM128,144a40,40,0,1,1,40-40A40,40,0,0,1,128,144Z" />
          </svg>
        </span>
      )}
    </span>
  );

  return (
    <>
      {canZoom ? (
        <button
          type="button"
          className={styles.button}
          onClick={(event) => {
            event.stopPropagation();
            setLightboxOpen(true);
          }}
          aria-label={`Agrandir la photo de ${displayName}`}
        >
          {avatar}
        </button>
      ) : (
        avatar
      )}
      {lightboxOpen && photoUrl ? (
        <AvatarLightbox
          src={photoUrl}
          alt={`Photo de ${displayName}`}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Initiales (prénom + nom) alignées Flutter ClubMember.initials. */
function memberInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}
