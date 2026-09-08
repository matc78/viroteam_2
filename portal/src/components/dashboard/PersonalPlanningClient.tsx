"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import planningStyles from "@/app/(dashboard)/planning/page.module.css";
import { useMultiClubPlanningChangeListener } from "@/lib/dashboard/usePlanningChangeListener";
import { subscribePersonalPlanningReload } from "@/lib/dashboard/personalPlanningReload";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { dateOnly } from "@/lib/firebase/eventService";
import {
  clubsAsTeamOptions,
  clubBrandColorById,
  eventsColoredByClub,
  loadPersonalPlanningAcrossClubs,
  resolvePersonalRsvpMemberId,
  type PersonalClubEventView,
  type PersonalPlanningData,
} from "@/lib/firebase/personalPlanningService";
import { expandEventsToLabelBlocks } from "@/lib/planning/calendarEventBlocks";
import type { PopoverAnchorRect } from "@/lib/planning/anchoredPopoverPosition";
import familyStyles from "@/components/family/FamilyPlanningClient.module.css";

/** Props du planning personnel (espace bureau ou famille). */
type PersonalPlanningClientProps = {
  /** Libellé eyebrow intro. */
  eyebrow?: string;
  /** True quand le panneau keep-alive est visible (déclenche un reload au retour). */
  isPanelActive?: boolean;
};

/**
 * Planning multi-clubs : events du viewer (joueur + coach) et des enfants liés.
 * Pas de création d’événement ; filtres = clubs.
 */
export function PersonalPlanningClient({
  eyebrow = "Personnel",
  isPanelActive = true,
}: PersonalPlanningClientProps) {
  const { user, profile, bureauClubs, familyClubs } = useAuth();

  const [view, setView] = useState<CalendarView>("week");
  const [cursor, setCursor] = useState(() => dateOnly(new Date()));
  const [selectedEvent, setSelectedEvent] =
    useState<PersonalClubEventView | null>(null);
  const [selectedEventAnchor, setSelectedEventAnchor] =
    useState<PopoverAnchorRect | null>(null);
  const [selectedEventColor, setSelectedEventColor] = useState<string | null>(
    null,
  );
  const [filters, setFilters] = useState<PlanningSidebarFilters>({
    teamIds: [],
    coachIds: [],
    categories: [],
    playerIds: [],
  });

  const [data, setData] = useState<PersonalPlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const dataRef = useRef<PersonalPlanningData | null>(null);
  const knownClubIdsRef = useRef<Set<string>>(new Set());
  const wasPanelActiveRef = useRef(isPanelActive);
  const [reloadStatusMessage, setReloadStatusMessage] = useState("");
  dataRef.current = data;

  const listenTargets = useMemo(() => {
    if (!data) return [];
    return data.clubs.map((club) => ({
      clubId: club.id,
      teamIds: (data.teamsByClub[club.id] ?? []).map((team) => team.id),
    }));
  }, [data]);

  const { hasNewEvents, resetFlag } = useMultiClubPlanningChangeListener(
    listenTargets,
    isPanelActive,
  );

  const bumpReload = useCallback((announce: boolean) => {
    resetFlag();
    setReloadToken((token) => token + 1);
    if (announce) {
      setReloadStatusMessage("Planning actualisé");
    }
  }, [resetFlag]);

  useEffect(() => {
    const becameActive = isPanelActive && !wasPanelActiveRef.current;
    wasPanelActiveRef.current = isPanelActive;
    if (becameActive) {
      bumpReload(false);
    }
  }, [isPanelActive, bumpReload]);

  useEffect(() => {
    return subscribePersonalPlanningReload(() => {
      if (!wasPanelActiveRef.current) return;
      bumpReload(true);
    });
  }, [bumpReload]);

  useEffect(() => {
    if (!reloadStatusMessage) return;
    const timeoutId = window.setTimeout(() => {
      setReloadStatusMessage("");
    }, 1500);
    return () => window.clearTimeout(timeoutId);
  }, [reloadStatusMessage]);

  const range = useMemo(() => {
    const month = cursor.getMonth();
    const year = cursor.getFullYear();
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month + 2, 0),
    };
  }, [cursor]);

  const clubs = useMemo(() => {
    const byId = new Map(
      [...bureauClubs, ...familyClubs].map((club) => [club.id, club]),
    );
    return [...byId.values()];
  }, [bureauClubs, familyClubs]);

  const clubsKey = useMemo(
    () =>
      clubs
        .map((club) => club.id)
        .sort()
        .join(","),
    [clubs],
  );

  useEffect(() => {
    if (!user || !profile) {
      setData(null);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const hasStale = dataRef.current !== null;
    if (hasStale) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    void loadPersonalPlanningAcrossClubs({
      uid: user.uid,
      profile,
      clubs,
      range,
    })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger le planning personnel.",
        );
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // clubs via clubsKey pour stabilité
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.uid,
    profile,
    clubsKey,
    range.start.getTime(),
    range.end.getTime(),
    reloadToken,
  ]);

  const reload = useCallback(() => {
    bumpReload(false);
  }, [bumpReload]);

  const clubOptions = useMemo(
    () => (data ? clubsAsTeamOptions(data.clubs) : []),
    [data],
  );

  const clubColorById = useMemo(
    () => (data ? clubBrandColorById(data.clubs) : new Map<string, string>()),
    [data],
  );

  useEffect(() => {
    if (clubOptions.length === 0) return;
    const nextIds = clubOptions.map((club) => club.id);
    setFilters((current) => {
      if (current.teamIds.length === 0) {
        knownClubIdsRef.current = new Set(nextIds);
        return { ...current, teamIds: nextIds };
      }
      const known = knownClubIdsRef.current;
      const preserved = nextIds.filter((id) => current.teamIds.includes(id));
      const newlyAdded = nextIds.filter((id) => !known.has(id));
      knownClubIdsRef.current = new Set(nextIds);
      const merged = [...new Set([...preserved, ...newlyAdded])];
      if (
        merged.length === current.teamIds.length &&
        merged.every((id) => current.teamIds.includes(id))
      ) {
        return current;
      }
      return { ...current, teamIds: merged };
    });
  }, [clubOptions]);

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    const selectedClubs = new Set(filters.teamIds);
    if (selectedClubs.size === 0) return [];
    return data.events.filter((event) => selectedClubs.has(event.clubId));
  }, [data, filters.teamIds]);

  const eventBlocks = useMemo(() => {
    if (!data || clubOptions.length === 0) return [];
    return expandEventsToLabelBlocks(
      eventsColoredByClub(filteredEvents),
      clubOptions,
      [],
      [],
      {
        teamIds: filters.teamIds,
        coachIds: [],
        categories: [],
        playerIds: [],
      },
      clubColorById,
    );
  }, [data, clubOptions, clubColorById, filteredEvents, filters.teamIds]);

  /** Resync le popover après reload RSVP. */
  useEffect(() => {
    if (!selectedEvent || !data?.events) return;
    const fresh = data.events.find(
      (event) => event.personalKey === selectedEvent.personalKey,
    );
    if (!fresh || fresh === selectedEvent) return;
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

  const rsvpMemberId = selectedEvent
    ? resolvePersonalRsvpMemberId({
        event: selectedEvent,
        viewerMemberId:
          data?.viewerMemberIdByClub[selectedEvent.clubId] ?? null,
        childMemberIds:
          data?.childMemberIdsByClub[selectedEvent.clubId] ?? [],
        viewerUid: user?.uid ?? null,
      })
    : null;

  /** Ids viewer + enfants pour filled/outline RSVP sur les blocs agenda. */
  const calendarViewerMatchIds = useMemo(() => {
    const ids = new Set<string>();
    if (user?.uid) ids.add(user.uid);
    if (!data) return [...ids];
    for (const memberId of Object.values(data.viewerMemberIdByClub)) {
      if (memberId) ids.add(memberId);
    }
    for (const childIds of Object.values(data.childMemberIdsByClub)) {
      for (const childId of childIds) {
        if (childId) ids.add(childId);
      }
    }
    return [...ids];
  }, [user?.uid, data]);

  if (loading && !data) {
    return <DashboardSkeleton variant="planning" />;
  }

  const partialWarning =
    data?.failedClubNames.length
      ? `Certains clubs n’ont pas pu être chargés : ${data.failedClubNames.join(", ")}.`
      : null;

  return (
    <div className={planningStyles.pageRoot}>
      <span className="sr-only" aria-live="polite">
        {reloadStatusMessage}
      </span>
      <DashboardPageIntro
        eyebrow={eyebrow}
        heading="Mon planning"
        onRefresh={reload}
        refreshing={refreshing}
        hasNewData={hasNewEvents}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {partialWarning ? (
        <p className={introStyles.lead} role="status">
          {partialWarning}
        </p>
      ) : null}

      {data ? (
        <div
          className={`${planningStyles.layout}${refreshing ? ` ${transitionStyles.refreshing}` : ""}`}
        >
          <PlanningSidebar
            cursor={cursor}
            selectedDay={cursor}
            teams={clubOptions}
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
            teamsSectionTitle="Clubs"
            emptyTeamsLabel="Aucun club"
            teamsSearchPlaceholder="Rechercher un club…"
            teamsSearchAriaLabel="Rechercher un club"
            teamColorById={clubColorById}
            className={familyStyles.sidebarCentered}
          />

          <div className={planningStyles.mainPane}>
            {filteredEvents.length === 0 && !refreshing ? (
              <p className={introStyles.lead}>
                Aucun événement te concernant sur cette période.
              </p>
            ) : null}
            <PlanningCalendar
              eventBlocks={eventBlocks}
              view={view}
              cursor={cursor}
              onViewChange={setView}
              onCursorChange={setCursor}
              onSelectDay={setCursor}
              onSelectEvent={(event, anchor, color) => {
                const personal =
                  data.events.find(
                    (item) =>
                      item.personalKey === event.id || item.id === event.id,
                  ) ?? null;
                setSelectedEvent(personal);
                setSelectedEventAnchor(anchor);
                setSelectedEventColor(color);
              }}
              onCreateEvent={() => undefined}
              pendingCreate={null}
              viewerMatchIds={calendarViewerMatchIds}
            />
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <PlanningEventDetailPanel
          event={selectedEvent}
          anchor={selectedEventAnchor}
          eventColor={selectedEventColor}
          teams={data?.teamsByClub[selectedEvent.clubId] ?? []}
          guestDirectory={
            data?.guestDirectoryByClub[selectedEvent.clubId] ?? {}
          }
          onClose={() => {
            setSelectedEvent(null);
            setSelectedEventAnchor(null);
            setSelectedEventColor(null);
          }}
          clubId={selectedEvent.clubId}
          linkedMemberId={rsvpMemberId}
          onRsvpUpdated={reload}
        />
      ) : null}
    </div>
  );
}
