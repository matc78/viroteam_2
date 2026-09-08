import { ClubObjectives } from "@/lib/clubSetup/constants";
import { clubObjectiveSymbol } from "@/lib/clubSetup/clubObjectivesUi";
import selectable from "./SetupSelectable.module.css";
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
  return (
    <button
      type="button"
      className={`${selectable.tile} ${styles.chip} ${selected ? selectable.tileSelected : ""}`}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className={selectable.symbol} aria-hidden>
        {clubObjectiveSymbol(objectiveKey)}
      </span>
      <span className={selectable.label}>{ClubObjectives.label(objectiveKey)}</span>
      {selected ? (
        <span className={selectable.check} aria-hidden>
          ✓
        </span>
      ) : null}
    </button>
  );
}
