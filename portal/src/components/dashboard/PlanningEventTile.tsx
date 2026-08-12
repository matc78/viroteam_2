import type { ClubEventView, EventType } from "@/lib/firebase/eventService";
import {
  eventTypeLabel,
  formatEventTime,
  formatEventWhen,
} from "@/lib/firebase/eventService";
import styles from "./PlanningEventTile.module.css";

/** Props d'une tuile événement planning. */
type PlanningEventTileProps = {
  event: ClubEventView;
  onSelect?: (event: ClubEventView) => void;
  compact?: boolean;
};

const TYPE_TONE: Record<EventType, string> = {
  training: "blue",
  match: "green",
  tournament: "amber",
  other: "neutral",
};

/** Tuile événement réutilisable (home aperçu + page planning). */
export function PlanningEventTile({
  event,
  onSelect,
  compact = false,
}: PlanningEventTileProps) {
  const teamsLabel = event.teamLabels.join(" · ");
  const whenLabel = compact
    ? formatEventWhen(event.startsAt)
    : formatEventTime(event.startsAt);

  const content = (
    <>
      <div className={styles.main}>
        <div className={styles.titleRow}>
          <span
            className={styles.typeBadge}
            data-tone={TYPE_TONE[event.type]}
          >
            {eventTypeLabel(event.type)}
          </span>
          <p className={styles.title}>{event.title}</p>
        </div>
        <p className={styles.meta}>
          {teamsLabel} · {whenLabel}
        </p>
        {event.location ? (
          <p className={styles.location}>{event.location}</p>
        ) : null}
      </div>
      <div className={styles.rsvp}>
        <span className={styles.rsvpValue}>
          {event.rsvpYes}/{event.rsvpTotal}
        </span>
        <span className={styles.rsvpLabel}>RSVP</span>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={styles.tile}
        onClick={() => onSelect(event)}
        aria-label={`${event.title}, ${teamsLabel}`}
      >
        {content}
      </button>
    );
  }

  return <div className={styles.tileStatic}>{content}</div>;
}
