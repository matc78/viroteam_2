import { ClubObjectives } from "@/lib/clubSetup/constants";
import { clubObjectiveSymbol } from "@/lib/clubSetup/clubObjectivesUi";
import { ClubSetupUi } from "@/lib/clubSetup/clubSetupUi";
import styles from "./ObjectiveChip.module.css";

type ObjectiveChipProps = {
  objectiveKey: string;
  selected: boolean;
  onToggle: () => void;
};

/** Puce sélectionnable pour un objectif club. */
export function ObjectiveChip({
  objectiveKey,
  selected,
  onToggle,
}: ObjectiveChipProps) {
  const accent = ClubSetupUi.objectiveAccent(objectiveKey);

  return (
    <button
      type="button"
      className={`${styles.chip} ${selected ? styles.chipSelected : ""}`}
      style={{
        borderColor: selected ? accent : undefined,
        background: selected
          ? `color-mix(in srgb, ${accent} 12%, white)`
          : undefined,
        color: selected ? accent : undefined,
      }}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className={styles.symbol} aria-hidden>
        {clubObjectiveSymbol(objectiveKey)}
      </span>
      <span>{ClubObjectives.label(objectiveKey)}</span>
      {selected ? (
        <span className={styles.check} style={{ color: accent }} aria-hidden>
          ✓
        </span>
      ) : null}
    </button>
  );
}
