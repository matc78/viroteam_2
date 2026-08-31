import type { PracticeLocation } from "@/lib/clubSetup/clubSetupDraft";
import styles from "./PracticeLocationChip.module.css";

type PracticeLocationChipProps = {
  location: PracticeLocation;
  accent: string;
  onRemove: () => void;
};

/** Tuile compacte d’un lieu de pratique ajouté. */
export function PracticeLocationChip({
  location,
  accent,
  onRemove,
}: PracticeLocationChipProps) {
  const label = location.address
    ? `${location.name} · ${location.address}`
    : location.name;

  return (
    <span
      className={styles.chip}
      style={{ ["--chip-accent" as string]: accent } as React.CSSProperties}
    >
      <span className={styles.label} title={label}>
        {label}
      </span>
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        aria-label={`Retirer ${location.name}`}
      >
        ×
      </button>
    </span>
  );
}
