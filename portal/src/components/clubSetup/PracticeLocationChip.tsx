import type { PracticeLocation } from "@/lib/clubSetup/clubSetupDraft";
import { PracticeLocationCategories } from "@/lib/clubSetup/constants";
import styles from "./PracticeLocationChip.module.css";

type PracticeLocationChipProps = {
  location: PracticeLocation;
  onRemove: () => void;
};

/** Tuile d’un lieu de pratique ajouté. */
export function PracticeLocationChip({
  location,
  onRemove,
}: PracticeLocationChipProps) {
  const nameLabel = location.name.trim() || "Lieu";
  const cityLabel = location.city?.trim() || "";
  const addressLabel = location.address?.trim() || "";
  const details = [cityLabel, addressLabel].filter(Boolean).join(" · ");
  const categoryLabel = location.category
    ? PracticeLocationCategories.label(
        location.category,
        location.categoryCustom,
      )
    : null;
  const fullLabel = [nameLabel, categoryLabel, details]
    .filter(Boolean)
    .join(" — ");

  return (
    <span className={styles.chip}>
      <span className={styles.content}>
        {categoryLabel ? (
          <span className={styles.category}>{categoryLabel}</span>
        ) : null}
        <span className={styles.label} title={fullLabel}>
          {nameLabel}
        </span>
        {details ? (
          <span className={styles.details}>{details}</span>
        ) : null}
      </span>
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        aria-label={`Retirer ${nameLabel}`}
      >
        ×
      </button>
    </span>
  );
}
