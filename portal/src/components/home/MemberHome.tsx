"use client";

import type { ReactNode } from "react";
import { AnnouncementsCard, type HomeAnnouncementItem } from "@/components/home/AnnouncementsCard";
import { EventListCard, type EventListRsvpTarget } from "@/components/home/EventListCard";
import { MemberFeeCard } from "@/components/home/MemberFeeCard";
import { NextEventCard } from "@/components/home/NextEventCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ClubEventView } from "@/lib/firebase/eventService";
import type { FeeSeasonRecord, MemberFeeRecord } from "@/lib/firebase/feeService";
import styles from "./home.module.css";

/** Props de l’accueil membre (joueur, ou parent pour un enfant). */
type MemberHomeProps = {
  eyebrow: string;
  title: string;
  /** Sous le titre : sélecteur d’audience famille. */
  headerExtra?: ReactNode;
  error: string | null;
  events: ClubEventView[];
  planningHref: string;
  feesHref: string;
  rsvp: EventListRsvpTarget | null;
  /** Question du prochain événement (« Tu viens ? »). */
  answerPrompt: string;
  emptyEventsText: string;
  fee: MemberFeeRecord | null;
  season: FeeSeasonRecord | null;
  remainingCents: number;
  /** Prénom de l’enfant suivi ; `null` pour soi. */
  childFirstName: string | null;
  announcements: HomeAnnouncementItem[];
};

/** Nombre de convocations sans réponse pour la fiche suivie. */
function countPendingAnswers(
  events: ClubEventView[],
  rsvp: EventListRsvpTarget | null,
): number {
  if (!rsvp) return 0;
  const memberId = rsvp.memberId;
  return events.filter((event) => {
    const invited =
      event.teamMemberIds.length === 0 ||
      event.teamMemberIds.includes(memberId);
    if (!invited) return false;
    return !event.rsvpByMemberId[memberId];
  }).length;
}

/**
 * Accueil membre : le prochain rendez-vous et la réponse à donner d’abord,
 * puis la suite du programme ; cotisation et annonces en colonne.
 */
export function MemberHome({
  eyebrow,
  title,
  headerExtra,
  error,
  events,
  planningHref,
  feesHref,
  rsvp,
  answerPrompt,
  emptyEventsText,
  fee,
  season,
  remainingCents,
  childFirstName,
  announcements,
}: MemberHomeProps) {
  const [nextEvent, ...laterEvents] = events;
  const pending = countPendingAnswers(events, rsvp);

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        actions={
          pending > 0 ? (
            <StatusBadge tone="warning" dot>
              {pending} réponse{pending > 1 ? "s" : ""} attendue
              {pending > 1 ? "s" : ""}
            </StatusBadge>
          ) : events.length > 0 && rsvp ? (
            <StatusBadge tone="success" dot>
              Toutes les réponses sont données
            </StatusBadge>
          ) : null
        }
      >
        {headerExtra}
      </PageHeader>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.memberGrid}>
        <div className={styles.column}>
          {nextEvent ? (
            <NextEventCard
              event={nextEvent}
              planningHref={planningHref}
              rsvp={rsvp}
              answerPrompt={answerPrompt}
            />
          ) : (
            <Card>
              <EmptyState variant="block" title="Rien de prévu pour l’instant">
                {emptyEventsText}
              </EmptyState>
            </Card>
          )}
          {laterEvents.length > 0 ? (
            <EventListCard
              title="Ensuite"
              titleId="member-later-events-title"
              events={laterEvents}
              planningHref={planningHref}
              emptyText={emptyEventsText}
              rsvp={rsvp}
            />
          ) : null}
        </div>

        <div className={styles.column}>
          <MemberFeeCard
            fee={fee}
            season={season}
            remainingCents={remainingCents}
            feesHref={feesHref}
            childFirstName={childFirstName}
          />
          <AnnouncementsCard items={announcements} />
        </div>
      </div>
    </>
  );
}
