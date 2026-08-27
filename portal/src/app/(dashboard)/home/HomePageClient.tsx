"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { CollectionsChart } from "@/components/dashboard/CollectionsChart";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FeeStatusChart } from "@/components/dashboard/FeeStatusChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { FamilyRsvpButtons } from "@/components/family/FamilyRsvpButtons";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberRoles } from "@/lib/firebase/constants";
import {
  loadCoachHomeDashboard,
  loadHomeDashboard,
  loadPlayerHomeDashboard,
  type CoachHomeDashboardData,
  type HomeDashboardData,
  type PlayerHomeDashboardData,
} from "@/lib/firebase/homeService";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import styles from "./page.module.css";

function formatEventWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Home admin (KPIs + charts cotisations). */
function AdminHomeView({
  data,
  refreshing,
  error,
  reload,
  showHelloAsso,
}: {
  data: HomeDashboardData | null;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
  showHelloAsso: boolean;
}) {
  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading={data ? `Bonjour ${data.adminDisplayName}` : "Tableau de bord"}
        lead={
          data
            ? `Vue d’ensemble de ${data.clubName} — ${data.seasonLabel}.`
            : "Chargement de votre espace club…"
        }
        onRefresh={reload}
        refreshing={refreshing}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.homeActions}>
        <Link href="/announcements" className={styles.announcementsCta}>
          Annonces
        </Link>
      </div>

      {data ? (
        <>
          <section className={styles.kpiGrid} aria-label="Indicateurs clés">
            {data.kpis.map((kpi) => (
              <KpiCard key={kpi.id} kpi={kpi} />
            ))}
          </section>

          <section className={styles.activityGrid} aria-label="Planning et alertes">
            <UpcomingEvents events={data.upcomingEvents} />
            <AttentionList items={data.attentionItems} />
          </section>

          <section className={styles.chartsGrid} aria-label="Cotisations">
            <FeeStatusChart segments={data.feeStatus} />
            <CollectionsChart
              months={data.collections}
              showHelloAsso={showHelloAsso}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

/** Home coach (scope équipes). */
function CoachHomeView({
  data,
  refreshing,
  error,
  reload,
}: {
  data: CoachHomeDashboardData | null;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
}) {
  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace coach"
        heading={data ? `Bonjour ${data.displayName}` : "Tableau de bord"}
        lead={
          data
            ? `Vue de vos équipes — ${data.clubName}.`
            : "Chargement de votre espace coach…"
        }
        onRefresh={reload}
        refreshing={refreshing}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.homeActions}>
        <Link href="/announcements" className={styles.announcementsCta}>
          Annonces
        </Link>
        <Link href="/planning" className={styles.announcementsCta}>
          Planning
        </Link>
      </div>

      {data ? (
        <>
          <section className={styles.kpiGrid} aria-label="Indicateurs coach">
            <KpiCard
              kpi={{
                id: "members",
                label: "Membres",
                value: data.memberCount,
                hint: "Sur vos équipes",
                tone: "neutral",
              }}
            />
            <KpiCard
              kpi={{
                id: "teams",
                label: "Équipes",
                value: data.teams.length,
                hint: "Que vous entraînez",
                tone: "accent",
              }}
            />
            <KpiCard
              kpi={{
                id: "trainings",
                label: "Entraînements prévus",
                value: data.trainingCount,
                hint: "14 prochains jours",
                tone: "success",
              }}
            />
            <KpiCard
              kpi={{
                id: "week",
                label: "Events semaine pro.",
                value: data.weekEvents.length,
                hint: "Lundi → dimanche",
                tone: "warning",
              }}
            />
          </section>

          <section
            className={`${panelStyles.panel} ${styles.teamsPanel}`}
            data-tone="green"
            aria-labelledby="coach-teams-title"
          >
            <h2 id="coach-teams-title" className={styles.sectionTitle}>
              Vos équipes
            </h2>
            {data.teams.length === 0 ? (
              <p className={styles.emptyHint}>
                Aucune équipe ne vous est encore assignée.
              </p>
            ) : (
              <ul className={styles.teamLinks}>
                {data.teams.map((team) => (
                  <li key={team.id}>
                    <Link
                      href={`/members?team=${encodeURIComponent(team.id)}`}
                      className={styles.teamLink}
                    >
                      <span className={styles.teamLinkName}>{team.name}</span>
                      <span className={styles.teamLinkMeta}>
                        {team.category ? `${team.category} · ` : ""}
                        {team.playerCount} joueur
                        {team.playerCount > 1 ? "s" : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.activityGrid} aria-label="Planning coach">
            <UpcomingEvents events={data.upcomingEvents} />
            <section
              className={panelStyles.panel}
              data-tone="cyan"
              aria-labelledby="week-rsvp-title"
            >
              <h2 id="week-rsvp-title" className={styles.sectionTitle}>
                Semaine prochaine — présences
              </h2>
              {data.weekEvents.length === 0 ? (
                <p className={styles.emptyHint}>
                  Aucun événement la semaine prochaine sur vos équipes.
                </p>
              ) : (
                <ul className={styles.weekList}>
                  {data.weekEvents.map((event) => (
                    <li key={event.id} className={styles.weekItem}>
                      <div>
                        <p className={styles.weekTitle}>{event.title}</p>
                        <p className={styles.weekMeta}>
                          {formatEventWhen(event.startsAt)}
                          {event.teamLabels.length > 0
                            ? ` · ${event.teamLabels.join(", ")}`
                            : ""}
                        </p>
                      </div>
                      <p className={styles.weekRsvp}>
                        {event.rsvpYes} oui · {event.rsvpPending} att. ·{" "}
                        {event.rsvpNo} non
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>
        </>
      ) : null}
    </div>
  );
}

/** Home joueur (events + RSVP + annonces). */
function PlayerHomeView({
  clubId,
  data,
  refreshing,
  error,
  reload,
}: {
  clubId: string;
  data: PlayerHomeDashboardData | null;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
}) {
  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Mon club"
        heading={data ? `Bonjour ${data.displayName}` : "Tableau de bord"}
        lead={
          data
            ? `Vos prochains rendez-vous — ${data.clubName}.`
            : "Chargement de votre espace…"
        }
        onRefresh={reload}
        refreshing={refreshing}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section
            className={`${panelStyles.panel} ${styles.announcementsPanel}`}
            data-tone="orange"
            aria-labelledby="player-announcements-title"
          >
            <h2 id="player-announcements-title" className={styles.sectionTitle}>
              Annonces
            </h2>
            {data.announcements.length === 0 ? (
              <p className={styles.emptyHint}>Aucune annonce en cours.</p>
            ) : (
              <ul className={styles.announcementList}>
                {data.announcements.map((announcement) => (
                  <li key={announcement.id} className={styles.announcementItem}>
                    <p className={styles.announcementMessage}>
                      {announcement.message}
                    </p>
                    <p className={styles.announcementMeta}>
                      {announcement.senderName}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className={panelStyles.panel}
            data-tone="cyan"
            aria-labelledby="player-events-title"
          >
            <header className={styles.playerEventsHeader}>
              <h2 id="player-events-title" className={styles.sectionTitle}>
                Prochains événements
              </h2>
              <Link href="/planning" className={styles.viewAllInline}>
                Voir le planning →
              </Link>
            </header>
            {data.upcomingEvents.length === 0 ? (
              <p className={styles.emptyHint}>
                Aucun événement à venir pour vous.
              </p>
            ) : (
              <ul className={styles.playerEventList}>
                {data.upcomingEvents.map((event) => (
                  <li key={event.id} className={styles.playerEventItem}>
                    <div>
                      <p className={styles.weekTitle}>{event.title}</p>
                      <p className={styles.weekMeta}>
                        {formatEventWhen(event.startsAt)}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                    {data.linkedMemberId ? (
                      <FamilyRsvpButtons
                        clubId={clubId}
                        event={event}
                        memberId={data.linkedMemberId}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

/** Contenu home dashboard branché sur Firestore, adapté au rôle club. */
export function HomePageClient() {
  const { activeClub, activeClubRole, profile, user } = useAuth();
  const displayName = profile?.displayName || "Membre";
  const role = activeClubRole ?? MemberRoles.admin;

  const adminResource = useAsyncClubResource(
    role === MemberRoles.admin ? activeClub : null,
    (club) =>
      loadHomeDashboard({
        club,
        adminDisplayName: displayName,
      }),
    [displayName, role],
  );

  const coachResource = useAsyncClubResource(
    role === MemberRoles.coach && user ? activeClub : null,
    (club) =>
      loadCoachHomeDashboard({
        club,
        displayName,
        uid: user!.uid,
      }),
    [displayName, role, user?.uid],
  );

  const playerResource = useAsyncClubResource(
    role === MemberRoles.player && user ? activeClub : null,
    (club) =>
      loadPlayerHomeDashboard({
        club,
        displayName,
        uid: user!.uid,
      }),
    [displayName, role, user?.uid],
  );

  const active = useMemo(() => {
    if (role === MemberRoles.coach) return coachResource;
    if (role === MemberRoles.player) return playerResource;
    return adminResource;
  }, [role, adminResource, coachResource, playerResource]);

  if (active.loading && !active.data) {
    return <DashboardSkeleton variant="home" />;
  }

  if (role === MemberRoles.coach) {
    return (
      <CoachHomeView
        data={coachResource.data}
        refreshing={coachResource.refreshing}
        error={coachResource.error}
        reload={coachResource.reload}
      />
    );
  }

  if (role === MemberRoles.player) {
    return (
      <PlayerHomeView
        clubId={activeClub?.id ?? ""}
        data={playerResource.data}
        refreshing={playerResource.refreshing}
        error={playerResource.error}
        reload={playerResource.reload}
      />
    );
  }

  return (
    <AdminHomeView
      data={adminResource.data}
      refreshing={adminResource.refreshing}
      error={adminResource.error}
      reload={adminResource.reload}
      showHelloAsso={activeClub?.onlinePaymentEnabled === true}
    />
  );
}
