"use client";

import type { CSSProperties } from "react";
import {
  readableTextOnBrand,
  splitBrandColorHex,
} from "@/lib/clubSetup/clubBrandColors";
import { ClubSetupDefaults } from "@/lib/clubSetup/constants";
import styles from "./chatShared.module.css";

type ClubBadgeProps = {
  name: string;
  /** Couleur de marque du club (`brandColorHex`), défaut ViroTeam sinon. */
  color?: string | null;
  className?: string;
};

/**
 * Pastille du club aux couleurs du club (texte lisible calculé), tronquée
 * en ellipse si le nom est long — inbox, en-tête du fil, fenêtre flottante.
 */
export function ClubBadge({ name, color, className }: ClubBadgeProps) {
  const brand = splitBrandColorHex(
    color ?? ClubSetupDefaults.brandColorHex,
  ).primary;
  return (
    <span
      className={`${styles.clubBadge}${className ? ` ${className}` : ""}`}
      title={name}
      style={
        {
          "--club-brand": brand,
          "--club-brand-text": readableTextOnBrand(brand),
        } as CSSProperties
      }
    >
      {name}
    </span>
  );
}
