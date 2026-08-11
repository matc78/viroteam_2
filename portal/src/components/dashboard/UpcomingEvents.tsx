import type { UpcomingEvent } from "@/lib/dashboard/mockHome";
import styles from "./UpcomingEvents.module.css";

type UpcomingEventsProps = {
  events: UpcomingEvent[];
};

/** Liste des prochains événements club (lecture admin). */
export function UpcomingEvents({ events }: UpcomingEventsProps) {
  const formatWhen = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <section className={styles.panel} aria-labelledby="upcoming-title">
      <header className={styles.header}>
        <h2 id="upcoming-title" className={styles.title}>
          Prochains événements
        </h2>
        <p className={styles.subtitle}>Vue lecture — planning club</p>
      </header>

      <ul className={styles.list}>
        {events.map((event) => (
          <li key={event.id} className={styles.item}>
            <div className={styles.itemMain}>
              <p className={styles.eventTitle}>{event.title}</p>
              <p className={styles.meta}>
                {event.team} · {formatWhen(event.startsAt)}
              </p>
              <p className={styles.location}>{event.location}</p>
            </div>
            <div className={styles.rsvp}>
              <span className={styles.rsvpValue}>
                {event.rsvpYes}/{event.rsvpTotal}
              </span>
              <span className={styles.rsvpLabel}>RSVP</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
