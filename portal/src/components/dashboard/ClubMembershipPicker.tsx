"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type {
  ClubMembershipTile,
  PortalSpace,
} from "@/lib/firebase/types";
import { MemberRoles, PortalUiRoles } from "@/lib/firebase/constants";
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
  clubs: ClubMembershipTile[];
  activeClubId: string | null;
  /** Espace courant — nécessaire si un club a deux pastilles (bureau + parent). */
  activeSpace: PortalSpace;
  /** Compact : header (sans bandeau full-width). */
  compact?: boolean;
  /** Affiche la pastille « + » vers /club-setup. */
  showCreateClub?: boolean;
  /**
   * Sous-titre custom (ex. nom de l’enfant en espace famille).
   * Si fourni, remplace le badge rôle pour cette pastille.
   */
  formatSecondaryLabel?: (club: ClubMembershipTile) => string | null;
  onClubChange: (clubId: string, space: PortalSpace) => void;
};

function hasRoleBadge(role: string | null): boolean {
  return (
    role === MemberRoles.admin ||
    role === MemberRoles.coach ||
    role === MemberRoles.player ||
    role === PortalUiRoles.parent
  );
}

/**
 * Liste horizontale des clubs rattachés : logo/emoji à gauche, nom + rôle à droite.
 * Club actif zoomé + couleur de marque ; badge rôle coloré si sélectionné.
 * Pastille « + » optionnelle vers le wizard de création de club.
 */
export function ClubMembershipPicker({
  clubs,
  activeClubId,
  activeSpace,
  compact = false,
  showCreateClub = false,
  formatSecondaryLabel,
  onClubChange,
}: ClubMembershipPickerProps) {
  if (clubs.length === 0 && !showCreateClub) return null;

  return (
    <div
      className={[
        compact ? styles.inline : styles.strip,
        showCreateClub ? styles.withCreate : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Clubs rattachés"
    >
      <div className={styles.scroll} role="tablist" aria-label="Choisir un club">
        {clubs.map((club) => {
          const isActive =
            club.id === activeClubId && club.space === activeSpace;
          const brand = splitBrandColorHex(
            club.brandColorHex ?? ClubSetupDefaults.brandColorHex,
          ).primary;
          const textColor = readableTextOnBrand(brand);
          const clubName = club.name.trim() || "Club";
          const secondaryLabel = formatSecondaryLabel?.(club) ?? null;

          return (
            <button
              key={`${club.space}-${club.id}`}
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
                if (!isActive) onClubChange(club.id, club.space);
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
                {secondaryLabel ? (
                  <span
                    className={`${styles.roleBadge}${isActive ? ` ${styles.roleBadgeActive}` : ""}`}
                  >
                    {secondaryLabel}
                  </span>
                ) : hasRoleBadge(club.role) ? (
                  <RoleBadge
                    role={club.role}
                    muted={!isActive}
                    size="sm"
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      {showCreateClub ? (
        <Link
          href="/club-setup"
          className={styles.createCard}
          aria-label="Créer un club"
        >
          <span className={styles.createPlus} aria-hidden>
            +
          </span>
        </Link>
      ) : null}
    </div>
  );
}
