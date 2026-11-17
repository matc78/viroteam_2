"use client";

import {
  buildClubBrandColorPresets,
  clubBrandColorsMatch,
} from "@/lib/clubSetup/clubBrandColors";
import styles from "./ClubBrandColorPicker.module.css";

const PRESETS = buildClubBrandColorPresets();

type ClubBrandColorPickerProps = {
  primaryHex: string;
  secondaryHex: string | null;
  disabled?: boolean;
  onPrimarySelected: (hex: string) => void;
  onSecondaryChanged: (hex: string | null) => void;
};

/**
 * Choix de la couleur du club : une couleur unie, plus une 2e couleur
 * facultative (re-clic pour la retirer). Parité avec
 * `ClubBrandColorPicker` de l’app Flutter.
 */
export function ClubBrandColorPicker({
  primaryHex,
  secondaryHex,
  disabled = false,
  onPrimarySelected,
  onSecondaryChanged,
}: ClubBrandColorPickerProps) {
  return (
    <div className={styles.picker}>
      <div className={styles.block}>
        <p className={styles.blockTitle} id="club-color-solid">
          Couleur unie
        </p>
        <div
          className={styles.swatches}
          role="group"
          aria-labelledby="club-color-solid"
        >
          {PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              className={styles.swatch}
              style={{ backgroundColor: hex }}
              aria-pressed={clubBrandColorsMatch(primaryHex, hex)}
              aria-label={`Couleur ${hex}`}
              disabled={disabled}
              onClick={() => onPrimarySelected(hex)}
            />
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockTitle} id="club-color-second">
          2e couleur (facultative)
        </p>
        <p className={styles.blockHint}>
          Pour un club bicolore. Re-clique sur la couleur pour la retirer.
        </p>
        <div
          className={styles.swatches}
          role="group"
          aria-labelledby="club-color-second"
        >
          {PRESETS.map((hex) => {
            const selected = clubBrandColorsMatch(secondaryHex, hex);
            return (
              <button
                key={hex}
                type="button"
                className={styles.swatch}
                style={{ backgroundColor: hex }}
                aria-pressed={selected}
                aria-label={`2e couleur ${hex}`}
                disabled={disabled || clubBrandColorsMatch(primaryHex, hex)}
                onClick={() => onSecondaryChanged(selected ? null : hex)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
