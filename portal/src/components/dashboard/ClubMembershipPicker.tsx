"use client";

import type { CSSProperties } from "react";
import type { ClubWithRole } from "@/lib/firebase/types";
import { MemberRoles } from "@/lib/firebase/constants";
import {
  readableTextOnBrand,
  splitBrandColorHex,
} from "@/lib/clubSetup/clubBrandColors";
import { ClubSetupDefaults } from "@/lib/clubSetup/constants";
import { sportEmoji } from "@/lib/sports/sportEmoji";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import styles from "./ClubMembershipPicker.module.css";

/** Props du sélecteur de clubs visible (pastilles horizontales). */
type ClubMembershipPickerProps = {
  clubs: ClubWithRole[];
  activeClubId: string | null;
  /** Sous-titre pastille (ex. espace famille → nom de l’enfant). */
  formatRoleLabel?: (role: string | null) => string;
  /** Compact : header (sans bandeau full-width). */
  compact?: boolean;
  onClubChange: (clubId: string) => void;
};

function isBureauRole(role: string | null): boolean {
  return (
    role === MemberRoles.admin ||
    role === MemberRoles.coach ||
    role === MemberRoles.player
  );
}

/**
 * Liste horizontale des clubs rattachés : logo/emoji à gauche, nom + rôle à droite.
 * Club actif zoomé + couleur de marque ; badge rôle coloré si sélectionné.
 */
export function ClubMembershipPicker({
  clubs,
  activeClubId,
  formatRoleLabel,
  compact = false,
  onClubChange,
}: ClubMembershipPickerProps) {
  if (clubs.length === 0) return null;

  return (
    <div
      className={compact ? styles.inline : styles.strip}
      aria-label="Clubs rattachés"
    >
      <div className={styles.scroll} role="tablist" aria-label="Choisir un club">
        {clubs.map((club) => {
          const isActive = club.id === activeClubId;
          const brand = splitBrandColorHex(
            club.brandColorHex ?? ClubSetupDefaults.brandColorHex,
          ).primary;
          const textColor = readableTextOnBrand(brand);
          const customLabel = formatRoleLabel?.(club.role) ?? null;
          const showBureauBadge = !formatRoleLabel && isBureauRole(club.role);
          const clubName = club.name.trim() || "Club";

          return (
            <button
              key={club.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.card}${isActive ? ` ${styles.cardActive}` : ""}`}
              style={
                {
                  "--club-brand": brand,
                  "--club-brand-text": textColor,
                } as CSSProperties
              }
              onClick={() => {
                if (!isActive) onClubChange(club.id);
              }}
            >
              {club.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={club.logoUrl}
                  alt=""
                  className={styles.clubMark}
                />
              ) : (
                <span className={styles.clubMarkEmoji} aria-hidden>
                  {sportEmoji(club.sport)}
                </span>
              )}
              <span className={styles.clubMeta}>
                <span className={styles.clubName}>{clubName}</span>
                {showBureauBadge ? (
                  <RoleBadge
                    role={club.role}
                    muted={!isActive}
                    size="sm"
                  />
                ) : customLabel ? (
                  <span
                    className={`${styles.roleBadge}${isActive ? ` ${styles.roleBadgeActive}` : ""}`}
                  >
                    {customLabel}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
