import { formatDayHeading } from "@/lib/firebase/eventService";
import styles from "./PlanningDaySection.module.css";

/** Props de l'en-tête de section jour. */
type PlanningDaySectionProps = {
  day: Date;
};

/** En-tête de jour pour grouper les événements. */
export function PlanningDaySection({ day }: PlanningDaySectionProps) {
  return (
    <h3 className={styles.heading}>
      <span className={styles.line} aria-hidden="true" />
      <span className={styles.label}>{formatDayHeading(day)}</span>
      <span className={styles.line} aria-hidden="true" />
    </h3>
  );
}
