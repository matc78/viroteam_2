import {
  ClubMemberCountRanges,
  ClubObjectives,
} from "@/lib/clubSetup/constants";
import { ClubSetupUi } from "@/lib/clubSetup/clubSetupUi";
import { ObjectiveChip } from "@/components/clubSetup/ObjectiveChip";
import styles from "./ObjectivesStep.module.css";

type ObjectivesStepProps = {
  selected: Set<string>;
  memberCountRange: string | null;
  onToggle: (key: string) => void;
  onMemberCountChanged: (range: string | null) => void;
};

/** Étape objectifs — priorités produit et taille du club. */
export function ObjectivesStep({
  selected,
  memberCountRange,
  onToggle,
  onMemberCountChanged,
}: ObjectivesStepProps) {
  return (
    <div className={styles.layout}>
        <div className={styles.objectiveGrid}>
          {ClubObjectives.all.map((objectiveKey) => (
            <ObjectiveChip
              key={objectiveKey}
              objectiveKey={objectiveKey}
              selected={selected.has(objectiveKey)}
              onToggle={() => onToggle(objectiveKey)}
            />
          ))}
        </div>

        <div className={styles.memberCountSection}>
          <p className={styles.memberCountTitle}>Combien de membres gérez-vous ?</p>
          <div className={styles.memberCountRow}>
            {ClubMemberCountRanges.all.map((range, index) => {
              const isSelected = memberCountRange === range;
              const accent =
                ClubSetupUi.sportAccents[index % ClubSetupUi.sportAccents.length];
              return (
                <button
                  key={range}
                  type="button"
                  className={`${styles.rangeChip} ${isSelected ? styles.rangeChipSelected : ""}`}
                  style={
                    isSelected
                      ? {
                          borderColor: accent,
                          background: `color-mix(in srgb, ${accent} 14%, white)`,
                          color: accent,
                        }
                      : undefined
                  }
                  onClick={() => onMemberCountChanged(isSelected ? null : range)}
                  aria-pressed={isSelected}
                >
                  {ClubMemberCountRanges.label(range)}
                </button>
              );
            })}
          </div>
        </div>
    </div>
  );
}
