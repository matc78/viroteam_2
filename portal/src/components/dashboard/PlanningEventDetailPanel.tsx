import type { ClubEventView } from "@/lib/firebase/eventService";
import {
  eventTypeLabel,
  formatEventWhen,
} from "@/lib/firebase/eventService";
import { rsvpStatLabel } from "@/lib/planning/rsvpLabels";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import panelStyles from "./DashboardPanel.module.css";
import styles from "./PlanningEventDetailPanel.module.css";

/** Props du panneau détail événement. */
type PlanningEventDetailPanelProps = {
  event: ClubEventView;
  onClose: () => void;
};

/** Détail lecture seule d'un événement avec stats RSVP. */
export function PlanningEventDetailPanel({
  event,
  onClose,
}: PlanningEventDetailPanelProps) {
  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={onClose}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") onClose();
      }}
    >
      <FadeScrollArea
        className={`${panelStyles.panel} ${styles.panel}`}
        viewportClassName={styles.panelContent}
        data-tone="cyan"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-title"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{eventTypeLabel(event.type)}</p>
            <h2 id="event-detail-title" className={styles.title}>
              {event.title}
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Fermer le détail"
          >
            ×
          </button>
        </header>

        <dl className={styles.details}>
          <div>
            <dt>Date</dt>
            <dd>{formatEventWhen(event.startsAt)}</dd>
          </div>
          <div>
            <dt>Équipe(s)</dt>
            <dd>{event.teamLabels.join(", ")}</dd>
          </div>
          {event.location ? (
            <div>
              <dt>Lieu</dt>
              <dd>{event.location}</dd>
            </div>
          ) : null}
        </dl>

        <section className={styles.rsvpSection} aria-label="Statistiques RSVP">
          <h3 className={styles.rsvpTitle}>Présences</h3>
          <div className={styles.rsvpGrid}>
            <div className={styles.rsvpStat} data-tone="green">
              <span className={styles.rsvpValue}>{event.rsvpYes}</span>
              <span className={styles.rsvpLabel}>
                {rsvpStatLabel(event.rsvpYes, "Présent", "Présents")}
              </span>
            </div>
            <div className={styles.rsvpStat} data-tone="orange">
              <span className={styles.rsvpValue}>{event.rsvpNo}</span>
              <span className={styles.rsvpLabel}>
                {rsvpStatLabel(event.rsvpNo, "Absent", "Absents")}
              </span>
            </div>
            <div className={styles.rsvpStat} data-tone="amber">
              <span className={styles.rsvpValue}>{event.rsvpPending}</span>
              <span className={styles.rsvpLabel}>En attente</span>
            </div>
          </div>
          <p className={styles.rsvpHint}>
            {event.rsvpTotal > 0
              ? `${event.rsvpYes} réponses positives sur ${event.rsvpTotal} convoqués`
              : "Aucune convocation enregistrée"}
          </p>
        </section>
      </FadeScrollArea>
    </div>
  );
}
