"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import {
  PlanningCalendar,
  type CalendarView,
} from "@/components/dashboard/PlanningCalendar";
import { PlanningEventDetailPanel } from "@/components/dashboard/PlanningEventDetailPanel";
import {
  PlanningSidebar,
  type PlanningSidebarFilters,
} from "@/components/dashboard/PlanningSidebar";
import { useFamilyAudience } from "@/components/family/FamilyAudienceProvider";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import planningStyles from "@/app/(dashboard)/planning/page.module.css";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import { usePlanningChangeListener } from "@/lib/dashboard/usePlanningChangeListener";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  dateOnly,
  loadPlanningEventsForGuardian,
  type ClubEventView,
} from "@/lib/firebase/eventService";
import {
  getClubMember,
  loadMembersByRosterIds,
} from "@/lib/firebase/memberService";
import { expandEventsToLabelBlocks } from "@/lib/planning/calendarEventBlocks";
import type { PopoverAnchorRect } from "@/lib/planning/anchoredPopoverPosition";
import { buildGuestDirectoryFromMembers } from "@/lib/planning/eventGuestRows";
import {
  eventVisibleToPlayer,
  memberMatchIds,
  rosterContains,
} from "@/lib/teams/viewerTeamScope";
import familyStyles from "./FamilyPlanningClient.module.css";

/** Planning famille : calendrier de l’enfant sélectionné, sans filtres bureau. */
export function FamilyPlanningClient() {
  const { activeClub, profile } = useAuth();
  const {
    selectedMemberId,
    selectedTarget,
    loading: audienceLoading,
  } = useFamilyAudience();

  const [view, setView] = useState<CalendarView>("week");
  const [cursor, setCursor] = useState(() => dateOnly(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<ClubEventView | null>(
    null,
  );
  const [selectedEventAnchor, setSelectedEventAnchor] =
    useState<PopoverAnchorRect | null>(null);
  const [selectedEventColor, setSelectedEventColor] = useState<string | null>(
    null,
  );
  const [filters, setFilters] = useState<PlanningSidebarFilters>({
    teamIds: [], coachIds: [], categories: [], playerIds: [],
  });

  const range = useMemo(() => {
    const month = cursor.getMonth();
    const year = cursor.getFullYear();
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month + 2, 0),
    };
  }, [cursor]);

  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub && selectedMemberId ? activeClub : null,
    async (club) => {
      if (!selectedMemberId) {
        return {
          events: [] as ClubEventView[],
          teams: [] as Awaited<
            ReturnType<typeof loadPlanningEventsForGuardian>
          >["teams"],
          guestDirectory: {},
        };
      }

      const member = await getClubMember(club.id, selectedMemberId);
      const childMatchIds = memberMatchIds({
        memberId: selectedMemberId,
        accountUid: member?.accountUid ?? null,
      });

      const teamIds = [
        ...new Set([
          ...(profile?.parentTeamIds ?? []),
          ...(member?.teamIds ?? []),
        ]),
      ];

      const loaded = await loadPlanningEventsForGuardian(club.id, teamIds, {
        start: range.start,
        end: range.end,
      });

      // Ne garder que les équipes / events de la fiche sélectionnée.
      const teams = loaded.teams.filter(
        (team) =>
          rosterContains(team.playerIds, childMatchIds) ||
          rosterContains(team.coachIds, childMatchIds),
      );
      const teamIdSet = new Set(teams.map((team) => team.id));
      const events = loaded.events.filter((event) =>
        eventVisibleToPlayer({
          event,
          viewerTeamIds: teamIdSet,
          playerMatchIds: childMatchIds,
        }),
      );

      const rosterIds = [
        ...new Set(
          teams.flatMap((team) => [...team.playerIds, ...team.coachIds]),
        ),
      ];
      const rosterMembers = await loadMembersByRosterIds(club.id, rosterIds);
      const guestDirectory = buildGuestDirectoryFromMembers(rosterMembers);

      return { events, teams, guestDirectory };
    },
    [
      selectedMemberId,
      selectedTarget?.kind,
      profile?.parentTeamIds,
      range.start.getTime(),
      range.end.getTime(),
    ],
  );

  /** Équipes à écouter : celles déjà chargées, sinon parentTeamIds. */
  const listenedTeamIds = useMemo(() => {
    if (data?.teams?.length) return data.teams.map((team) => team.id);
    return [...new Set(profile?.parentTeamIds ?? [])].filter(Boolean);
  }, [data?.teams, profile?.parentTeamIds]);

  const { hasNewEvents, resetFlag } = usePlanningChangeListener(
    activeClub?.id ?? null,
    listenedTeamIds,
  );

  /** Recharge les données et acquitte le flag de changement. */
  function handleRefresh() {
    resetFlag();
    reload();
  }

  /** Initialise les filtres équipe quand les données arrivent. */
  const teamOptions = useMemo(
    () => data?.teams ?? [],
    [data],
  );

  useEffect(() => {
    if (teamOptions.length > 0) {
      setFilters((current) => ({
        ...current,
        teamIds: teamOptions.map((team) => team.id),
      }));
    }
  }, [teamOptions]);

  const eventBlocks = useMemo(() => {
    if (!data || data.teams.length === 0) return [];
    return expandEventsToLabelBlocks(
      data.events,
      data.teams,
      [],
      [],
      {
        teamIds: data.teams.map((team) => team.id),
        coachIds: [],
        categories: [],
        playerIds: [],
      },
    );
  }, [data]);

  /** Garde le popover ouvert synchronisé après un reload RSVP. */
  useEffect(() => {
    if (!selectedEvent || !data?.events) return;
    const fresh = data.events.find((event) => event.id === selectedEvent.id);
    if (!fresh) return;
    if (fresh === selectedEvent) return;
    if (
      fresh.rsvpYes === selectedEvent.rsvpYes &&
      fresh.rsvpNo === selectedEvent.rsvpNo &&
      fresh.rsvpPending === selectedEvent.rsvpPending &&
      JSON.stringify(fresh.rsvpByMemberId) ===
        JSON.stringify(selectedEvent.rsvpByMemberId)
    ) {
      return;
    }
    setSelectedEvent(fresh);
  }, [data?.events, selectedEvent]);

  if ((loading || audienceLoading) && !data) {
    return <DashboardSkeleton variant="planning" />;
  }

  return (
    <div className={planningStyles.pageRoot}>
      <DashboardPageIntro
        eyebrow="Espace famille"
        heading="Planning"
        onRefresh={handleRefresh}
        refreshing={refreshing}
        hasNewData={hasNewEvents}
        accentColor={activeClub?.brandColorHex?.split("+")?.[0]}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <div
          className={`${planningStyles.layout}${refreshing ? ` ${transitionStyles.refreshing}` : ""}`}
        >
          <PlanningSidebar
            cursor={cursor}
            selectedDay={cursor}
            teams={[]}
            coaches={[]}
            players={[]}
            categories={[]}
            filters={filters}
            onFiltersChange={setFilters}
            onCursorChange={setCursor}
            onDaySelect={(day) => {
              setCursor(day);
              setView("day");
            }}
            onCreateClick={() => undefined}
            canCreate={false}
            teamsOnlyFilters
            hideFilters
            className={familyStyles.sidebarCentered}
          />

          <div className={planningStyles.mainPane}>
            <PlanningCalendar
              eventBlocks={eventBlocks}
              view={view}
              cursor={cursor}
              onViewChange={setView}
              onCursorChange={setCursor}
              onSelectDay={setCursor}
              onSelectEvent={(event, anchor, color) => {
                setSelectedEvent(event);
                setSelectedEventAnchor(anchor);
                setSelectedEventColor(color);
              }}
              onCreateEvent={() => undefined}
              pendingCreate={null}
            />
          </div>
        </div>
      ) : null}

      {selectedEvent && activeClub && selectedMemberId ? (
        <PlanningEventDetailPanel
          event={selectedEvent}
          anchor={selectedEventAnchor}
          eventColor={selectedEventColor}
          teams={data?.teams ?? []}
          guestDirectory={data?.guestDirectory ?? {}}
          onClose={() => {
            setSelectedEvent(null);
            setSelectedEventAnchor(null);
            setSelectedEventColor(null);
          }}
          clubId={activeClub.id}
          linkedMemberId={selectedMemberId}
          onRsvpUpdated={reload}
        />
      ) : null}
    </div>
  );
}
