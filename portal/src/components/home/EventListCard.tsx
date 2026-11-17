"use client";

import Link from "next/link";
import { FamilyRsvpButtons } from "@/components/family/FamilyRsvpButtons";
import { RsvpSummaryBar } from "@/components/home/RsvpSummaryBar";
import { Card, CardHeader } from "@/components/ui/Card";
import { DateBadge } from "@/components/ui/DateBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow, ListRows } from "@/components/ui/ListRow";
import { TextLink } from "@/components/ui/Button";
import type { ClubEventView } from "@/lib/firebase/eventService";
import { eventMetaLine } from "./homeFormat";
import styles from "./home.module.css";

/** Réponse personnelle possible depuis la liste (membre convoqué). */
export type EventListRsvpTarget = {
  clubId: string;
  /** Id de fiche (= uid si liée) : seule clé de convocation et de réponse. */
  memberId: string;
  onUpdated?: () => void;
};

/** Props de la carte liste d’événements. */
type EventListCardProps = {
  title: string;
  titleId: string;
  subtitle?: string;
  events: ClubEventView[];
  planningHref: string;
  emptyText: string;
  /** Affiche la barre présents / absents (vue staff). */
  showRsvpSummary?: boolean;
  /** Boutons Oui / Peut-être / Non pour la fiche convoquée. */
  rsvp?: EventListRsvpTarget | null;
};

function withQuery(href: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  return `${href}${href.includes("?") ? "&" : "?"}${query}`;
}

/** Liste dense d’événements : date, titre cliquable, méta, réponses. */
export function EventListCard({
  title,
  titleId,
  subtitle,
  events,
  planningHref,
  emptyText,
  showRsvpSummary = false,
  rsvp = null,
}: EventListCardProps) {
  return (
    <Card padding="none" aria-labelledby={titleId}>
      <CardHeader
        title={title}
        titleId={titleId}
        subtitle={subtitle}
        action={
          <TextLink href={withQuery(planningHref, { teams: "all" })}>
            Planning
          </TextLink>
        }
      />
      {events.length === 0 ? (
        <div className={styles.cardEmpty}>
          <EmptyState>{emptyText}</EmptyState>
        </div>
      ) : (
        <ListRows aria-label={title}>
          {events.map((event) => {
            const personal = rsvp ? (
              <FamilyRsvpButtons
                clubId={rsvp.clubId}
                event={event}
                memberId={rsvp.memberId}
                onUpdated={() => rsvp.onUpdated?.()}
                size="sm"
              />
            ) : null;
            return (
              <ListRow
                key={event.id}
                leading={<DateBadge iso={event.startsAt} />}
                title={
                  <Link
                    href={withQuery(planningHref, { eventId: event.id })}
                    className={styles.eventLink}
                  >
                    {event.title}
                  </Link>
                }
                meta={eventMetaLine(event)}
                trailing={
                  showRsvpSummary ? (
                    <RsvpSummaryBar
                      yes={event.rsvpYes}
                      no={event.rsvpNo}
                      pending={event.rsvpPending}
                      total={event.rsvpTotal}
                    />
                  ) : (
                    personal
                  )
                }
                footer={showRsvpSummary ? personal : undefined}
              />
            );
          })}
        </ListRows>
      )}
    </Card>
  );
}
