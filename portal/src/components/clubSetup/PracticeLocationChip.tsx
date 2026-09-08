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
  const cityLabel = location.city?.trim() || "";
  const addressLabel = location.address?.trim() || "";
  const details = [cityLabel, addressLabel].filter(Boolean).join(" · ");
  const fallback = location.name;
  const mainLabel = details || fallback;
  const categoryLabel = location.category
    ? PracticeLocationCategories.label(
        location.category,
        location.categoryCustom,
      )
    : null;
  const fullLabel = categoryLabel ? `${categoryLabel} — ${mainLabel}` : mainLabel;

  return (
    <span className={styles.chip}>
      <span className={styles.content}>
        {categoryLabel ? (
          <span className={styles.category}>{categoryLabel}</span>
        ) : null}
        <span className={styles.label} title={fullLabel}>
          {mainLabel}
        </span>
      </span>
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        aria-label={`Retirer ${mainLabel}`}
      >
        ×
      </button>
    </span>
  );
}
