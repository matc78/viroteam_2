import type { ClubEventView } from "@/lib/firebase/eventService";
import {
  eventTypeLabel,
  formatEventWhen,
} from "@/lib/firebase/eventService";
import { rsvpStatLabel } from "@/lib/planning/rsvpLabels";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { FamilyRsvpButtons } from "@/components/family/FamilyRsvpButtons";
import panelStyles from "./DashboardPanel.module.css";
import styles from "./PlanningEventDetailPanel.module.css";

type RsvpRowStatus = "yes" | "no" | "pending";

/** Props du panneau détail événement. */
type PlanningEventDetailPanelProps = {
  event: ClubEventView;
  onClose: () => void;
  clubId?: string;
  /** Si fourni, affiche les boutons RSVP pour ce membre. */
  linkedMemberId?: string | null;
  onRsvpUpdated?: () => void;
  /** Noms affichables indexés par memberId / accountUid. */
  memberNamesById?: Record<string, string>;
};

function resolveRsvpRowStatus(
  memberId: string,
  rsvpByMemberId: Record<string, string>,
): RsvpRowStatus {
  const value = (rsvpByMemberId[memberId] ?? "").toLowerCase();
  if (value === "yes") return "yes";
  if (value === "no") return "no";
  return "pending";
}

function rsvpRowLabel(status: RsvpRowStatus): string {
  switch (status) {
    case "yes":
      return "Présent";
    case "no":
      return "Absent";
    default:
      return "En attente";
  }
}

const STATUS_ORDER: Record<RsvpRowStatus, number> = {
  yes: 0,
  no: 1,
  pending: 2,
};

/** Détail lecture seule d'un événement avec stats et liste RSVP. */
export function PlanningEventDetailPanel({
  event,
  onClose,
  clubId,
  linkedMemberId,
  onRsvpUpdated,
  memberNamesById = {},
}: PlanningEventDetailPanelProps) {
  const rsvpRows = event.teamMemberIds
    .map((memberId) => {
      const status = resolveRsvpRowStatus(memberId, event.rsvpByMemberId);
      return {
        memberId,
        name: memberNamesById[memberId]?.trim() || "Membre",
        status,
      };
    })
    .sort((left, right) => {
      const byStatus = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
      if (byStatus !== 0) return byStatus;
      return left.name.localeCompare(right.name, "fr");
    });

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
          <h3 className={styles.rsvpTitle}>Réponses</h3>
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

        {rsvpRows.length > 0 ? (
          <section className={styles.rsvpSection} aria-label="Liste des réponses">
            <h3 className={styles.rsvpTitle}>Convoqués</h3>
            <ul className={styles.rsvpList}>
              {rsvpRows.map((row) => (
                <li key={row.memberId} className={styles.rsvpRow}>
                  <span className={styles.rsvpName}>{row.name}</span>
                  <span
                    className={styles.rsvpBadge}
                    data-status={row.status}
                  >
                    {rsvpRowLabel(row.status)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {clubId && linkedMemberId ? (
          <section className={styles.rsvpSection} aria-label="Votre réponse">
            <h3 className={styles.rsvpTitle}>Votre réponse</h3>
            <FamilyRsvpButtons
              clubId={clubId}
              event={event}
              memberId={linkedMemberId}
              onUpdated={onRsvpUpdated}
            />
          </section>
        ) : null}
      </FadeScrollArea>
    </div>
  );
}
