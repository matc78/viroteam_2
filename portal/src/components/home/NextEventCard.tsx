"use client";

import Link from "next/link";
import { FamilyRsvpButtons } from "@/components/family/FamilyRsvpButtons";
import { Card } from "@/components/ui/Card";
import { DateBadge } from "@/components/ui/DateBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ClubEventView } from "@/lib/firebase/eventService";
import type { EventListRsvpTarget } from "./EventListCard";
import { formatEventLongWhen, safeEventTypeLabel } from "./homeFormat";
import styles from "./home.module.css";

/** Carte mise en avant du prochain événement, avec la réponse modifiable. */
export function NextEventCard({
  event,
  planningHref,
  rsvp,
  answerPrompt,
}: {
  event: ClubEventView;
  planningHref: string;
  rsvp: EventListRsvpTarget | null;
  /** Question au-dessus des boutons (« Tu viens ? », « Léo vient ? »). */
  answerPrompt: string;
}) {
  const typeLabel = safeEventTypeLabel(event.type);
  return (
    <Card variant="highlight" aria-label="Prochain événement">
      <p className={styles.kicker}>Prochain rendez-vous</p>
      <div className={styles.nextEvent}>
        <DateBadge iso={event.startsAt} size="lg" />
        <div className={styles.nextEventBody}>
          <Link
            href={`${planningHref}?eventId=${encodeURIComponent(event.id)}`}
            className={styles.nextEventTitle}
          >
            {event.title}
          </Link>
          <p className={styles.nextEventWhen}>
            {formatEventLongWhen(event.startsAt)}
          </p>
          <div className={styles.nextEventTags}>
            {typeLabel ? <StatusBadge tone="info">{typeLabel}</StatusBadge> : null}
            {event.location ? (
              <span className={styles.nextEventPlace}>{event.location}</span>
            ) : null}
          </div>
        </div>
      </div>
      {rsvp ? (
        <div className={styles.nextEventAnswer}>
          <span className={styles.nextEventPrompt}>{answerPrompt}</span>
          <FamilyRsvpButtons
            clubId={rsvp.clubId}
            event={event}
            memberId={rsvp.memberId}
            onUpdated={() => rsvp.onUpdated?.()}
          />
        </div>
      ) : null}
    </Card>
  );
}
