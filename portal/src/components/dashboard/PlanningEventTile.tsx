import type { ClubEventView, EventType } from "@/lib/firebase/eventService";
import {
  eventTypeLabel,
  formatEventTime,
  formatEventWhen,
} from "@/lib/firebase/eventService";
import { rsvpStatLabel } from "@/lib/planning/rsvpLabels";
import styles from "./PlanningEventTile.module.css";

/** Props d'une tuile événement planning. */
type PlanningEventTileProps = {
  event: ClubEventView;
  onSelect?: (event: ClubEventView) => void;
  compact?: boolean;
  /** Affiche Présents / Absents / En attente au lieu du ratio RSVP seul. */
  detailedRsvp?: boolean;
};

const TYPE_TONE: Record<EventType, string> = {
  training: "blue",
  match: "green",
  tournament: "amber",
  other: "neutral",
};

/**
 * Détail à afficher à côté du badge type (sans redoubler « Entraînement - … »).
 */
function eventDetailLabel(event: ClubEventView): string | null {
  if (event.type === "other") {
    const title = event.title.trim();
    return title || null;
  }
  const typeLabel = eventTypeLabel(event.type);
  const teamLabel =
    event.teamLabels.find((label) => label && label !== "Club") ?? null;
  if (teamLabel) return teamLabel;

  const trimmed = event.title.trim();
  if (!trimmed || trimmed === typeLabel) return null;
  const prefix = `${typeLabel} - `;
  if (trimmed.startsWith(prefix)) {
    const rest = trimmed.slice(prefix.length).trim();
    return rest || null;
  }
  return trimmed;
}

/** Tuile événement réutilisable (home aperçu + page planning). */
export function PlanningEventTile({
  event,
  onSelect,
  compact = false,
  detailedRsvp = false,
}: PlanningEventTileProps) {
  const teamsLabel = event.teamLabels.join(" · ");
  const whenLabel = compact
    ? formatEventWhen(event.startsAt)
    : formatEventTime(event.startsAt);
  const detailLabel = eventDetailLabel(event);

  const rsvpBlock = detailedRsvp ? (
    <div className={styles.rsvpBreakdown} aria-label="Réponses RSVP">
      <span className={styles.rsvpStat} data-tone="green">
        <span className={styles.rsvpStatValue}>{event.rsvpYes}</span>
        <span className={styles.rsvpStatLabel}>
          {rsvpStatLabel(event.rsvpYes, "Présent", "Présents")}
        </span>
      </span>
      <span className={styles.rsvpStat} data-tone="orange">
        <span className={styles.rsvpStatValue}>{event.rsvpNo}</span>
        <span className={styles.rsvpStatLabel}>
          {rsvpStatLabel(event.rsvpNo, "Absent", "Absents")}
        </span>
      </span>
      <span className={styles.rsvpStat} data-tone="amber">
        <span className={styles.rsvpStatValue}>{event.rsvpPending}</span>
        <span className={styles.rsvpStatLabel}>En attente</span>
      </span>
    </div>
  ) : (
    <div className={styles.rsvp}>
      <span className={styles.rsvpValue}>
        {event.rsvpYes}/{event.rsvpTotal}
      </span>
      <span className={styles.rsvpLabel}>RSVP</span>
    </div>
  );

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
          {detailLabel ? <p className={styles.title}>{detailLabel}</p> : null}
        </div>
        <p className={styles.meta}>
          {teamsLabel} · {whenLabel}
        </p>
        {event.location ? (
          <p className={styles.location}>{event.location}</p>
        ) : null}
        {detailedRsvp ? rsvpBlock : null}
      </div>
      {detailedRsvp ? null : rsvpBlock}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={`${styles.tile}${detailedRsvp ? ` ${styles.tileDetailed}` : ""}`}
        onClick={() => onSelect(event)}
        aria-label={`${event.title}, ${teamsLabel}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`${styles.tileStatic}${detailedRsvp ? ` ${styles.tileDetailed}` : ""}`}
    >
      {content}
    </div>
  );
}
