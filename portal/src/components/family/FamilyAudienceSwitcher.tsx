"use client";

import { useFamilyAudience } from "./FamilyAudienceProvider";
import styles from "./FamilyAudienceSwitcher.module.css";

/**
 * Puces enfants, ou segment Moi | prénom si l’adulte est aussi licencié.
 * Un seul enfant sans licence : rien (pas de sélecteur).
 */
export function FamilyAudienceSwitcher() {
  const { targets, selectedMemberId, setSelectedMemberId } = useFamilyAudience();
  const hasSelf = targets.some((target) => target.kind === "self");
  const childCount = targets.filter((target) => target.kind === "child").length;

  if (targets.length <= 1) return null;
  if (!hasSelf && childCount <= 1) return null;

  return (
    <div className={styles.row} role="tablist" aria-label="Pour qui">
      {targets.map((target) => {
        const selected = target.memberId === selectedMemberId;
        return (
          <button
            key={`${target.kind}-${target.memberId}`}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.chip}${selected ? ` ${styles.chipActive}` : ""}`}
            onClick={() => setSelectedMemberId(target.memberId)}
          >
            {target.label}
          </button>
        );
      })}
    </div>
  );
}
