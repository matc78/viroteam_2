"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UpcomingEvent } from "@/lib/firebase/homeService";
import panelStyles from "./DashboardPanel.module.css";
import { PlanningEventTile } from "./PlanningEventTile";
import styles from "./UpcomingEvents.module.css";

/** Props de l'aperçu événements home. */
type UpcomingEventsProps = {
  events: UpcomingEvent[];
  planningHref?: string;
};

/** Ajoute un paramètre de query à une URL planning. */
function withPlanningQuery(
  baseHref: string,
  params: Record<string, string>,
): string {
  const query = new URLSearchParams(params).toString();
  if (!query) return baseHref;
  const separator = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${separator}${query}`;
}

/** Aperçu des prochains événements club avec détail des réponses RSVP. */
export function UpcomingEvents({
  events,
  planningHref = "/planning",
}: UpcomingEventsProps) {
  const router = useRouter();

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
          <p className={styles.subtitle}>14 prochains jours · réponses RSVP</p>
        </div>
        <Link
          href={withPlanningQuery(planningHref, { teams: "all" })}
          className={styles.viewAllLink}
        >
          Voir tout →
        </Link>
      </header>

      {events.length === 0 ? (
        <p className={styles.empty}>
          Aucun événement prévu dans les 14 prochains jours.
        </p>
      ) : (
        <ul className={styles.list}>
          {events.map((event) => (
            <li key={event.id} className={styles.item}>
              <PlanningEventTile
                event={event}
                compact
                detailedRsvp
                onSelect={() =>
                  router.push(
                    withPlanningQuery(planningHref, { eventId: event.id }),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
