"use client";

import { AnnouncementsCard } from "@/components/home/AnnouncementsCard";
import { AttentionCard } from "@/components/home/AttentionCard";
import { EventListCard } from "@/components/home/EventListCard";
import { firstNameOf } from "@/components/home/homeFormat";
import { FeeStatusChart } from "@/components/dashboard/FeeStatusChart";
import { RecentActivityPreview } from "@/components/dashboard/RecentActivityPreview";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatGrid, StatTile } from "@/components/ui/StatTile";
import type { StatusTone } from "@/components/ui/StatusBadge";
import type { HomeDashboardData, HomeKpi } from "@/lib/firebase/homeService";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import homeStyles from "@/components/home/home.module.css";

/** Page détaillée et tonalité d’un KPI admin (la couleur signale une action). */
function kpiPresentation(kpi: HomeKpi): { href: string; tone: StatusTone } {
  switch (kpi.id) {
    case "rsvp-rate":
      return { href: "/planning", tone: kpi.value < 50 ? "warning" : "neutral" };
    case "paid-rate":
      return { href: "/fees", tone: "neutral" };
    case "due-euros":
      return { href: "/fees", tone: kpi.value > 0 ? "warning" : "success" };
    default:
      return { href: "/planning", tone: "neutral" };
  }
}

/**
 * Accueil club (compte qui voit tout le club ou les cotisations) : ce qui
 * demande une action d’abord, puis les chiffres clés, puis le programme
 * (gauche) et le suivi club (droite). Blocs cotisations et journal selon
 * les droits `viewFees` / `viewActivity`.
 */
export function AdminHomeView({
  clubId,
  data,
  refreshing,
  error,
  reload,
  showFees,
  showActivity,
}: {
  clubId: string;
  data: HomeDashboardData | null;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
  /** Droit `viewFees` : chiffres et graphique des cotisations. */
  showFees: boolean;
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

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <PageHeader
        eyebrow={data ? `${data.clubName} · ${data.seasonLabel}` : "Espace club"}
        title={data ? `Bonjour ${firstNameOf(data.adminDisplayName)}` : "Accueil"}
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
          <AttentionCard items={data.attentionItems} />

          <div className={homeStyles.section}>
            <StatGrid>
              {data.kpis.map((kpi) => {
                const { href, tone } = kpiPresentation(kpi);
                return (
                  <StatTile
                    key={kpi.id}
                    label={kpi.label}
                    value={kpi.value}
                    unit={kpi.suffix ? ` ${kpi.suffix}` : undefined}
                    hint={kpi.hint}
                    tone={tone}
                    href={href}
                  />
                );
              })}
            </StatGrid>
          </div>

          <div className={homeStyles.staffGrid}>
            <div className={homeStyles.column}>
              <EventListCard
                title="Prochains événements du club"
                titleId="admin-club-upcoming-title"
                subtitle="14 prochains jours"
                events={data.upcomingEvents}
                planningHref="/planning"
                emptyText="Aucun événement prévu dans les 14 prochains jours."
                showRsvpSummary
              />
              {data.hasCoachedTeams || data.coachedUpcomingEvents.length > 0 ? (
                <EventListCard
                  title="Les équipes que tu entraînes"
                  titleId="admin-coached-upcoming-title"
                  subtitle="Réponses de tes joueurs"
                  events={data.coachedUpcomingEvents}
                  planningHref="/planning"
                  emptyText="Rien de prévu pour tes équipes."
                  showRsvpSummary
                  rsvp={personalRsvp}
                />
              ) : null}
              {data.hasPlayerTeams || data.playerUpcomingEvents.length > 0 ? (
                <EventListCard
                  title="Mes convocations"
                  titleId="admin-player-upcoming-title"
                  subtitle="Équipes où tu joues"
                  events={data.playerUpcomingEvents}
                  planningHref="/planning"
                  emptyText="Aucune convocation à venir."
                  rsvp={personalRsvp}
                />
              ) : null}
            </div>

            <div className={homeStyles.column}>
              {showFees ? (
                <FeeStatusChart segments={data.feeStatus} viewAllHref="/fees" />
              ) : null}
              <AnnouncementsCard
                items={data.announcements.map((item) => ({
                  id: item.id,
                  message: item.message,
                  author: item.senderName,
                  createdAt: item.createdAt,
                  targetLabel: item.targetLabel,
                }))}
                viewAllHref="/announcements"
              />
              {showActivity ? <RecentActivityPreview clubId={clubId} /> : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
