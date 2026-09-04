"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { CollectionsChart } from "@/components/dashboard/CollectionsChart";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FeeStatusChart } from "@/components/dashboard/FeeStatusChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { FamilyRsvpButtons } from "@/components/family/FamilyRsvpButtons";
import {
  readableTextOnBrand,
  splitBrandColorHex,
} from "@/lib/clubSetup/clubBrandColors";
import { ClubSetupDefaults } from "@/lib/clubSetup/constants";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberFeeStatuses, MemberRoles } from "@/lib/firebase/constants";
import {
  loadCoachHomeDashboard,
  loadHomeDashboard,
  loadPlayerHomeDashboard,
  type CoachHomeDashboardData,
  type HomeDashboardData,
  type PlayerHomeDashboardData,
} from "@/lib/firebase/homeService";
import { isDeadlineToday } from "@/lib/firebase/feeService";
import { feeStatusLabel } from "@/lib/members/membersView";
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

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
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
                Semaine prochaine — réponses RSVP
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
  brandColorHex,
  data,
  refreshing,
  error,
  reload,
}: {
  clubId: string;
  brandColorHex: string | null;
  data: PlayerHomeDashboardData | null;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
}) {
  const feeDue =
    data?.fee &&
    data.season &&
    (data.fee.status === MemberFeeStatuses.aPayer ||
      data.fee.status === MemberFeeStatuses.partiel) &&
    data.remainingCents > 0;
  const feeDeadlineToday =
    feeDue &&
    data?.season?.paymentDeadlineAt != null &&
    isDeadlineToday(data.season.paymentDeadlineAt);
  const feeStatus = data?.fee?.status ?? null;
  const announcementCount = data?.announcements.length ?? 0;
  const eventCount = data?.upcomingEvents.length ?? 0;
  const brand = splitBrandColorHex(
    brandColorHex ?? ClubSetupDefaults.brandColorHex,
  );
  const brandPrimary = brand.primary;
  const brandAlt = brand.secondary ?? brand.primary;
  const clubBrandStyle = {
    "--club-brand": brandPrimary,
    "--club-brand-alt": brandAlt,
    "--club-brand-text": readableTextOnBrand(brandPrimary),
    "--club-brand-alt-text": readableTextOnBrand(brandAlt),
  } as CSSProperties;

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Mon club"
        heading={data ? `Bonjour ${data.displayName}` : "Tableau de bord"}
        lead={
          data
            ? `Annonces, convocations et cotisation — ${data.clubName}.`
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
        <div className={styles.playerStack} style={clubBrandStyle}>
          <div className={styles.summaryChips} aria-label="Résumé">
            <span
              className={`${styles.summaryChip} ${
                feeDeadlineToday
                  ? styles.summaryChipDeadline
                  : feeDue
                    ? styles.summaryChipAlert
                    : styles.summaryChipOk
              }`}
            >
              <span className={styles.summaryChipLabel}>Cotisation</span>
              <span className={styles.summaryChipValue}>
                {feeDue
                  ? formatEuros(data.remainingCents)
                  : feeStatus
                    ? feeStatusLabel(feeStatus)
                    : "—"}
              </span>
            </span>
            <span className={styles.summaryChip}>
              <span className={styles.summaryChipLabel}>Annonces</span>
              <span className={styles.summaryChipValue}>{announcementCount}</span>
            </span>
            <span className={`${styles.summaryChip} ${styles.summaryChipAlt}`}>
              <span className={styles.summaryChipLabel}>Événements</span>
              <span className={styles.summaryChipValue}>{eventCount}</span>
            </span>
          </div>

          {feeDue ? (
            <section
              className={`${panelStyles.panel} ${styles.playerPanel}${feeDeadlineToday ? ` ${styles.playerPanelDeadline}` : ""}`}
              data-tone="brand"
              aria-label="Cotisation"
            >
              <header className={styles.playerPanelHeader}>
                <h2 className={styles.sectionTitle}>Cotisation</h2>
                <span
                  className={`${styles.statusChip} ${
                    feeDeadlineToday
                      ? styles.statusChipDeadline
                      : styles.statusChipWarn
                  }`}
                >
                  {feeDeadlineToday ? "Échéance aujourd'hui" : feeStatusLabel(feeStatus)}
                </span>
              </header>
              <p className={styles.feeAmount}>{formatEuros(data.remainingCents)}</p>
              <p className={styles.feeHint}>
                {feeDeadlineToday
                  ? "Dernier jour pour régler votre cotisation"
                  : "Reste à régler pour la saison en cours"}
              </p>
              <Link href="/fees" className={styles.feeBannerLink}>
                Voir la cotisation →
              </Link>
            </section>
          ) : null}

          <section
            className={`${panelStyles.panel} ${styles.playerPanel}`}
            data-tone="brand"
            aria-labelledby="player-announcements-title"
          >
            <header className={styles.playerPanelHeader}>
              <h2 id="player-announcements-title" className={styles.sectionTitle}>
                Annonces
              </h2>
              <span className={styles.countChip}>{announcementCount}</span>
            </header>
            {announcementCount === 0 ? (
              <p className={styles.emptyHint}>Aucune annonce en cours.</p>
            ) : (
              <ul className={styles.announcementChipList}>
                {data.announcements.map((announcement) => (
                  <li key={announcement.id} className={styles.announcementChip}>
                    <p className={styles.announcementMessage}>
                      {announcement.message}
                    </p>
                    <span className={styles.metaChip}>
                      {announcement.senderName || "Club"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className={`${panelStyles.panel} ${styles.playerPanel}`}
            data-tone="brand-alt"
            aria-labelledby="player-events-title"
          >
            <header className={styles.playerPanelHeader}>
              <h2 id="player-events-title" className={styles.sectionTitle}>
                Prochains événements
              </h2>
              <div className={styles.playerPanelActions}>
                <span className={`${styles.countChip} ${styles.countChipAlt}`}>
                  {eventCount}
                </span>
                <Link href="/planning" className={styles.viewAllInline}>
                  Planning →
                </Link>
              </div>
            </header>
            {eventCount === 0 ? (
              <p className={styles.emptyHint}>
                Aucun événement à venir pour vous.
              </p>
            ) : (
              <ul className={styles.eventChipList}>
                {data.upcomingEvents.map((event) => (
                  <li key={event.id} className={styles.eventChip}>
                    <span className={styles.eventWhenChip}>
                      {formatEventWhen(event.startsAt)}
                    </span>
                    <div className={styles.eventChipBody}>
                      <p className={styles.weekTitle}>{event.title}</p>
                      {event.location ? (
                        <p className={styles.weekMeta}>{event.location}</p>
                      ) : null}
                      {data.linkedMemberId ? (
                        <FamilyRsvpButtons
                          clubId={clubId}
                          event={event}
                          memberId={data.linkedMemberId}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
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
        brandColorHex={activeClub?.brandColorHex ?? null}
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
