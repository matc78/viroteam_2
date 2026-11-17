"use client";

import { EventListCard } from "@/components/home/EventListCard";
import { firstNameOf } from "@/components/home/homeFormat";
import { RecentActivityPreview } from "@/components/dashboard/RecentActivityPreview";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow, ListRows } from "@/components/ui/ListRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatGrid, StatTile } from "@/components/ui/StatTile";
import type { CoachHomeDashboardData } from "@/lib/firebase/homeService";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import homeStyles from "@/components/home/home.module.css";

/**
 * Accueil des équipes entraînées (coach sans droit de vue club) : réponses
 * de ses équipes en premier, chiffres de la semaine, ses équipes et, avec le
 * droit `viewActivity`, l’activité récente en colonne.
 */
export function CoachHomeView({
  clubId,
  data,
  refreshing,
  error,
  reload,
  showActivity,
}: {
  clubId: string;
  data: CoachHomeDashboardData | null;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
  /** Droit `viewActivity` : aperçu du journal. */
  showActivity: boolean;
}) {
  const personalRsvp =
    data?.linkedMemberId != null
      ? {
          clubId,
          memberId: data.linkedMemberId,
          onUpdated: reload,
        }
      : null;
  const pendingAnswers =
    data?.coachedUpcomingEvents.reduce(
      (sum, event) => sum + event.rsvpPending,
      0,
    ) ?? 0;

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <PageHeader
        eyebrow={data ? data.clubName : "Espace coach"}
        title={data ? `Bonjour ${firstNameOf(data.displayName)}` : "Accueil"}
        actions={
          <>
            <ButtonLink href="/announcements" size="sm">
              Publier une annonce
            </ButtonLink>
            <ButtonLink href="/planning" size="sm" variant="primary">
              Ouvrir le planning
            </ButtonLink>
          </>
        }
      />

      {error ? (
        <p className={homeStyles.error} role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className={homeStyles.section}>
            <StatGrid>
              <StatTile
                label="Réponses en attente"
                value={pendingAnswers}
                hint="Sur tes prochains événements"
                tone={pendingAnswers > 0 ? "warning" : "success"}
                href="/planning"
              />
              <StatTile
                label="Événements la semaine prochaine"
                value={data.weekEvents.length}
                hint="Lundi → dimanche"
                href="/planning"
              />
              <StatTile
                label="Entraînements prévus"
                value={data.trainingCount}
                hint="14 prochains jours"
                href="/planning"
              />
              <StatTile
                label="Joueurs"
                value={data.memberCount}
                hint={`${data.teams.length} équipe${data.teams.length > 1 ? "s" : ""}`}
                href="/members"
              />
            </StatGrid>
          </div>

          <div className={homeStyles.staffGrid}>
            <div className={homeStyles.column}>
              <EventListCard
                title="Prochains événements de tes équipes"
                titleId="coached-upcoming-title"
                subtitle="14 prochains jours · qui vient"
                events={data.coachedUpcomingEvents}
                planningHref="/planning"
                emptyText="Aucun événement prévu dans les 14 prochains jours."
                showRsvpSummary
                rsvp={personalRsvp}
              />
              {data.hasPlayerTeams || data.playerUpcomingEvents.length > 0 ? (
                <EventListCard
                  title="Mes convocations"
                  titleId="player-upcoming-title"
                  subtitle="Équipes où tu joues"
                  events={data.playerUpcomingEvents}
                  planningHref="/planning"
                  emptyText="Aucune convocation à venir."
                  rsvp={personalRsvp}
                />
              ) : null}
            </div>

            <div className={homeStyles.column}>
              <Card padding="none" aria-labelledby="coach-teams-title">
                <CardHeader title="Mes équipes" titleId="coach-teams-title" />
                {data.teams.length === 0 ? (
                  <div className={homeStyles.cardEmpty}>
                    <EmptyState>
                      Aucune équipe ne t’est encore assignée.
                    </EmptyState>
                  </div>
                ) : (
                  <ListRows aria-label="Mes équipes">
                    {data.teams.map((team) => (
                      <ListRow
                        key={team.id}
                        href={`/members?team=${encodeURIComponent(team.id)}`}
                        title={team.name}
                        meta={team.category || undefined}
                        trailing={
                          <span className={homeStyles.teamCount}>
                            {team.playerCount} joueur
                            {team.playerCount > 1 ? "s" : ""}
                          </span>
                        }
                      />
                    ))}
                  </ListRows>
                )}
              </Card>
              {showActivity ? <RecentActivityPreview key={clubId} clubId={clubId} /> : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
