import Link from "next/link";
import type { UpcomingEvent } from "@/lib/firebase/homeService";
import panelStyles from "./DashboardPanel.module.css";
import { PlanningEventTile } from "./PlanningEventTile";
import styles from "./UpcomingEvents.module.css";

/** Props de l'aperçu événements home. */
type UpcomingEventsProps = {
  events: UpcomingEvent[];
};

/** Aperçu des prochains événements club (home dashboard). */
export function UpcomingEvents({ events }: UpcomingEventsProps) {
  return (
    <section
      className={panelStyles.panel}
      data-tone="cyan"
      aria-labelledby="upcoming-title"
    >
      <header className={styles.header}>
        <div>
          <h2 id="upcoming-title" className={styles.title}>
            Prochains événements
          </h2>
          <p className={styles.subtitle}>14 prochains jours</p>
        </div>
        <Link href="/planning" className={styles.viewAllLink}>
          Voir tout →
        </Link>
      </header>

      {events.length === 0 ? (
        <p className={styles.empty}>Aucun événement prévu dans les 14 prochains jours.</p>
      ) : (
        <ul className={styles.list}>
          {events.map((event) => (
            <li key={event.id} className={styles.item}>
              <PlanningEventTile event={event} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
