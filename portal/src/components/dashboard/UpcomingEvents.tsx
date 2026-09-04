"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FamilyRsvpButtons } from "@/components/family/FamilyRsvpButtons";
import type { UpcomingEvent } from "@/lib/firebase/homeService";
import panelStyles from "./DashboardPanel.module.css";
import { PlanningEventTile } from "./PlanningEventTile";
import styles from "./UpcomingEvents.module.css";

/** Props de l'aperçu événements home. */
type UpcomingEventsProps = {
  events: UpcomingEvent[];
  planningHref?: string;
  title?: string;
  subtitle?: string;
  /** Id accessibilité du titre (unique si plusieurs sections). */
  titleId?: string;
  /** Affiche Présents / Absents / En attente (vue coach). */
  detailedRsvp?: boolean;
  /** Si fourni avec linkedMemberId, tente d’afficher le RSVP perso (si convoqué). */
  clubId?: string;
  linkedMemberId?: string | null;
  /** Aliases audience (uid, etc.) pour matcher teamMemberIds / rsvp. */
  audienceIds?: string[];
  onRsvpUpdated?: () => void;
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
  title = "Prochains événements",
  subtitle = "14 prochains jours · réponses RSVP",
  titleId = "upcoming-title",
  detailedRsvp = true,
  clubId,
  linkedMemberId = null,
  audienceIds,
  onRsvpUpdated,
}: UpcomingEventsProps) {
  const router = useRouter();
  const showPersonalRsvp = Boolean(clubId && linkedMemberId);

  return (
    <section
      className={panelStyles.panel}
      data-tone="cyan"
      aria-labelledby={titleId}
    >
      <header className={styles.header}>
        <div>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
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
                detailedRsvp={detailedRsvp}
                onSelect={() =>
                  router.push(
                    withPlanningQuery(planningHref, { eventId: event.id }),
                  )
                }
              />
              {showPersonalRsvp && clubId && linkedMemberId ? (
                <div
                  className={styles.rsvpRow}
                  onClick={(clickEvent) => clickEvent.stopPropagation()}
                  onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
                >
                  <FamilyRsvpButtons
                    clubId={clubId}
                    event={event}
                    memberId={linkedMemberId}
                    audienceIds={audienceIds}
                    onUpdated={() => onRsvpUpdated?.()}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
