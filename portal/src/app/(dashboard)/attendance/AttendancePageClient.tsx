"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAsyncClubPageResource } from "@/components/common/useAsyncClubPageResource";
import { AttendanceBar } from "@/components/attendance/AttendanceBar";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  SegmentedChoice,
  type SegmentedOption,
} from "@/components/ui/SegmentedChoice";
import { StatTile } from "@/components/ui/StatTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  attendancePeriodStart,
  computeTeamAttendance,
  isLowResponder,
  summarizeAttendance,
  type AttendancePeriod,
  type PlayerAttendance,
  type TeamAttendance,
} from "@/lib/attendance/attendanceStats";
import { teamsVisibleToViewer } from "@/lib/auth/bureauPermissions";
import { teamsCoachedByViewer } from "@/lib/teams/viewerTeamScope";
import { useBureauCapabilities } from "@/lib/auth/useBureauCapabilities";
import { loadAttendanceData } from "@/lib/firebase/attendanceService";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { eventTypeLabel } from "@/lib/firebase/eventService";
import { sortTeamCategories } from "@/lib/teams/compareTeamCategories";
import styles from "./page.module.css";

const PERIOD_OPTIONS: ReadonlyArray<SegmentedOption<AttendancePeriod>> = [
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "3 mois" },
  { value: "season", label: "Saison" },
];

const PERIOD_HINTS: Record<AttendancePeriod, string> = {
  "30d": "sur 30 jours",
  "90d": "sur 3 mois",
  season: "depuis le 1er août",
};

const ALL_TEAMS = "";

function formatRate(rate: number | null): string {
  return rate === null ? "–" : `${rate} %`;
}

function formatEventDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Page Présences : réponses RSVP des joueurs convoqués par équipe et par
 * joueur, sur 30 jours, 3 mois ou la saison. Staff : tout le club ; coach :
 * ses équipes. `?team=` ouvre directement une équipe.
 */
function AttendancePageContent() {
  const { activeClub, user } = useAuth();
  const caps = useBureauCapabilities();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const teamParam = searchParams.get("team") ?? ALL_TEAMS;
  const [period, setPeriod] = useState<AttendancePeriod>("30d");
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);

  const { data, loading, refreshing, error, reload } = useAsyncClubPageResource(
    activeClub,
    (club) => {
      const now = new Date();
      return loadAttendanceData({
        clubId: club.id,
        start: attendancePeriodStart(period, now),
        end: now,
      });
    },
    [period],
    "/attendance",
  );

  const teamStats: TeamAttendance[] = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    // Staff : tout le club ; coach : ses seules équipes entraînées (pas
    // celles où il joue).
    const visible = caps.seesWholeClub
      ? teamsVisibleToViewer({ caps, uid: user?.uid ?? null, teams: data.teams })
      : user
        ? teamsCoachedByViewer(data.teams, user.uid)
        : [];
    const order = sortTeamCategories(
      visible.map((team) => team.category),
      activeClub?.sport,
    );
    const rank = (category: string) => {
      const index = order.indexOf(category.trim());
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    return [...visible]
      .sort(
        (a, b) =>
          rank(a.category) - rank(b.category) ||
          a.name.localeCompare(b.name, "fr"),
      )
      .map((team) =>
        computeTeamAttendance({
          team,
          events: data.events,
          names: data.names,
          now,
        }),
      );
  }, [data, caps, user, activeClub?.sport]);

  const selected =
    teamStats.find((stats) => stats.team.id === teamParam) ?? null;
  const scope = selected ? [selected] : teamStats;
  const summary = summarizeAttendance({
    teams: scope.map((stats) => stats.team),
    events: data?.events ?? [],
    now: new Date(),
  });

  // Défilement vers une section après un changement de vue (l’équipe
  // choisie doit être rendue avant de défiler vers ses joueurs).
  useEffect(() => {
    if (!pendingScroll) return;
    const target = document.getElementById(pendingScroll);
    if (!target) return; // section pas encore rendue : on attend `selected`
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingScroll(null);
  }, [pendingScroll, selected]);

  /**
   * « À relancer » : ouvre la liste des joueurs concernés — l’équipe affichée,
   * la seule équipe concernée, sinon le tableau des équipes (badges cliquables).
   */
  function showLowResponders() {
    if (selected) {
      setPendingScroll("attendance-players");
      return;
    }
    const concerned = teamStats.filter((team) =>
      team.players.some(isLowResponder),
    );
    if (concerned.length === 1) {
      selectTeam(concerned[0].team.id);
      setPendingScroll("attendance-players");
      return;
    }
    setPendingScroll("attendance-teams");
  }

  /** Ouvre une équipe et défile jusqu’à ses joueurs. */
  function openTeamPlayers(teamId: string) {
    selectTeam(teamId);
    setPendingScroll("attendance-players");
  }

  function selectTeam(teamId: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (teamId) next.set("team", teamId);
    else next.delete("team");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  if (loading && !data) {
    return <DashboardSkeleton variant="members" />;
  }

  return (
    <div className={styles.page}>
      <DashboardPageIntro
        eyebrow="Club"
        heading="Présences"
        lead="Réponses des convoqués aux événements passés : part de « oui » (une réponse corrigée par le coach compte). « Oui joueurs » pour suivre l’effectif, « oui équipe » avec les coachs. Les événements à venir ne comptent pas."
        onRefresh={reload}
        refreshing={refreshing}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.toolbar}>
        <SegmentedChoice
          options={PERIOD_OPTIONS}
          value={period}
          ariaLabel="Période"
          size="sm"
          onSelect={setPeriod}
        />
        {teamStats.length > 1 ? (
          <label className={styles.teamSelect}>
            <span className="sr-only">Équipe</span>
            <select
              value={selected?.team.id ?? ALL_TEAMS}
              onChange={(event) => selectTeam(event.target.value)}
            >
              <option value={ALL_TEAMS}>Toutes les équipes</option>
              {teamStats.map((stats) => (
                <option key={stats.team.id} value={stats.team.id}>
                  {stats.team.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {data?.truncated ? (
        <p className={introStyles.lead} role="status">
          Beaucoup d’événements sur cette période : les plus récents ne sont
          peut-être pas tous comptés. Choisis une période plus courte.
        </p>
      ) : null}

      {teamStats.length === 0 ? (
        <EmptyState title="Aucune équipe à suivre" variant="block">
          Les présences s’affichent pour les équipes que tu gères ou entraînes.
        </EmptyState>
      ) : (
        <>
          <div className={styles.tiles}>
            <StatTile
              label="Oui joueurs"
              value={summary.rate ?? "–"}
              unit={summary.rate === null ? undefined : "%"}
              hint={`${summary.totals.yes} oui sur ${summary.totals.convoked} convocations`}
              tone={
                summary.rate !== null && summary.rate < 50 ? "warning" : "neutral"
              }
            />
            <StatTile
              label="Oui équipe"
              value={summary.allRate ?? "–"}
              unit={summary.allRate === null ? undefined : "%"}
              hint={`joueurs et coachs · ${summary.allTotals.yes} oui sur ${summary.allTotals.convoked}`}
            />
            <StatTile
              label="Ont répondu"
              value={summary.allResponseRate ?? "–"}
              unit={summary.allResponseRate === null ? undefined : "%"}
              hint={`joueurs et coachs · ${summary.allTotals.none} sans réponse`}
            />
            <StatTile
              label="Événements"
              value={summary.eventCount}
              hint={PERIOD_HINTS[period]}
            />
            <StatTile
              label="À relancer"
              value={summary.lowResponders}
              hint="joueurs qui répondent moins d’une fois sur deux"
              tone={summary.lowResponders > 0 ? "warning" : "neutral"}
              onClick={
                summary.lowResponders > 0 ? showLowResponders : undefined
              }
            />
          </div>

          {selected ? (
            <TeamDetail stats={selected} onBack={() => selectTeam(ALL_TEAMS)} showBack={teamStats.length > 1} />
          ) : (
            <TeamsTable
              stats={teamStats}
              onSelect={selectTeam}
              onShowLowResponders={openTeamPlayers}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Tableau des équipes (vue d’ensemble). */
function TeamsTable({
  stats,
  onSelect,
  onShowLowResponders,
}: {
  stats: TeamAttendance[];
  onSelect: (teamId: string) => void;
  /** Badge « N à relancer » : ouvre l’équipe sur ses joueurs. */
  onShowLowResponders: (teamId: string) => void;
}) {
  return (
    <section className={styles.card} aria-labelledby="attendance-teams">
      <header className={styles.cardHeading}>
        <h2 id="attendance-teams" className={styles.cardTitle}>
          Par équipe
        </h2>
        <p className={styles.cardHint}>
          « Oui » = part des convocations avec une réponse oui ; « Ont
          répondu » = oui, non ou peut-être. Oui joueurs, entraînements et
          matchs : joueurs seulement ; les deux colonnes suivantes comptent
          aussi les coachs.
        </p>
      </header>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Équipe</th>
              <th scope="col" className={styles.barCol}>
                Oui joueurs
              </th>
              <th scope="col" className={styles.num}>
                Entraînements
              </th>
              <th scope="col" className={styles.num}>
                Matchs
              </th>
              <th scope="col" className={styles.num}>
                Oui avec coachs
              </th>
              <th scope="col" className={styles.num}>
                Ont répondu
              </th>
              <th scope="col" className={styles.num}>
                Événements
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((team) => {
              const lowResponders = team.players.filter(isLowResponder).length;
              return (
                <tr key={team.team.id}>
                  <td>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => onSelect(team.team.id)}
                    >
                      {team.team.name}
                    </button>
                    {lowResponders > 0 ? (
                      <StatusBadge
                        tone="warning"
                        onClick={() => onShowLowResponders(team.team.id)}
                        actionLabel={`Voir les ${lowResponders} joueur${lowResponders > 1 ? "s" : ""} à relancer de ${team.team.name}`}
                      >
                        {lowResponders} à relancer
                      </StatusBadge>
                    ) : null}
                  </td>
                  <td className={styles.barCol}>
                    <AttendanceBar rate={team.rate} />
                  </td>
                  <td className={styles.num}>{formatRate(team.trainingRate)}</td>
                  <td className={styles.num}>{formatRate(team.matchRate)}</td>
                  <td
                    className={styles.num}
                    title={`${team.allTotals.yes} oui sur ${team.allTotals.convoked} convocations`}
                  >
                    {formatRate(team.allRate)}
                  </td>
                  <td
                    className={styles.num}
                    title={`${team.allTotals.convoked - team.allTotals.none} réponses (oui, non ou peut-être) sur ${team.allTotals.convoked} convocations`}
                  >
                    {formatRate(team.allResponseRate)}
                  </td>
                  <td className={styles.num}>{team.eventCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Détail d’une équipe : joueurs puis derniers événements. */
function TeamDetail({
  stats,
  onBack,
  showBack,
}: {
  stats: TeamAttendance;
  onBack: () => void;
  showBack: boolean;
}) {
  return (
    <div className={styles.detail}>
      <section className={styles.card} aria-labelledby="attendance-players">
        <header className={styles.cardHeader}>
          <h2 id="attendance-players" className={styles.cardTitle}>
            {stats.team.name} · joueurs
          </h2>
          {showBack ? (
            <button type="button" className={styles.linkButton} onClick={onBack}>
              Toutes les équipes
            </button>
          ) : null}
        </header>
        {stats.players.length === 0 ? (
          <EmptyState>Aucun joueur dans l’effectif.</EmptyState>
        ) : (
          <MemberAttendanceTable
            members={stats.players}
            firstColumn="Joueur"
            flagLowResponders
          />
        )}
        {stats.coaches.length > 0 ? (
          <>
            <h3 className={styles.subTitle}>
              Coachs · {formatRate(stats.allRate)} de oui sur toute l’équipe
            </h3>
            <MemberAttendanceTable members={stats.coaches} firstColumn="Coach" />
          </>
        ) : null}
      </section>

      <section className={styles.card} aria-labelledby="attendance-events">
        <h2 id="attendance-events" className={styles.cardTitle}>
          Derniers événements
        </h2>
        {stats.events.length === 0 ? (
          <EmptyState>Aucun événement passé sur la période.</EmptyState>
        ) : (
          <ul className={styles.eventList}>
            {stats.events.slice(0, 12).map((event) => (
              <li key={event.id} className={styles.eventRow}>
                <span className={styles.eventText}>
                  <span className={styles.eventTitle}>
                    {event.title.trim() || eventTypeLabel(event.type)}
                  </span>
                  <span className={styles.eventMeta}>
                    {formatEventDay(event.startsAt)} · {event.yes} oui sur{" "}
                    {event.convoked} joueurs
                    {event.coachConvoked > 0
                      ? ` · ${event.coachYes} oui sur ${event.coachConvoked} coachs`
                      : ""}
                    {event.none > 0 ? ` · ${event.none} sans réponse` : ""}
                  </span>
                </span>
                <AttendanceBar rate={event.rate} compact />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Tableau des réponses par personne (joueurs ou coachs d’une équipe). */
function MemberAttendanceTable({
  members,
  firstColumn,
  flagLowResponders = false,
}: {
  members: PlayerAttendance[];
  firstColumn: string;
  /** Badge « Répond peu » (joueurs seulement). */
  flagLowResponders?: boolean;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{firstColumn}</th>
            <th scope="col" className={styles.barCol}>
              % oui
            </th>
            <th scope="col" className={styles.num}>
              Oui
            </th>
            <th scope="col" className={styles.num}>
              <abbr title="Peut-être">P.-ê.</abbr>
            </th>
            <th scope="col" className={styles.num}>
              Non
            </th>
            <th scope="col" className={styles.num}>
              <abbr title="Sans réponse">S. rép.</abbr>
            </th>
            <th scope="col" className={styles.num}>
              <abbr title="Convocations">Conv.</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.memberId}>
              <td>
                <span className={styles.playerName}>{member.name}</span>
                {flagLowResponders && isLowResponder(member) ? (
                  <StatusBadge tone="warning">Répond peu</StatusBadge>
                ) : null}
              </td>
              <td className={styles.barCol}>
                <AttendanceBar rate={member.rate} />
              </td>
              <td className={styles.num}>{member.yes}</td>
              <td className={styles.num}>{member.maybe}</td>
              <td className={styles.num}>{member.no}</td>
              <td className={styles.num}>{member.none}</td>
              <td className={styles.num}>{member.convoked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Client Présences (Suspense pour searchParams). */
export function AttendancePageClient() {
  return (
    <Suspense fallback={<DashboardSkeleton variant="members" />}>
      <AttendancePageContent />
    </Suspense>
  );
}
