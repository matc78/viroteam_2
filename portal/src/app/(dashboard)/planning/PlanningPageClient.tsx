"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import {
  PlanningCalendar,
  type CalendarView,
  type CreateEventDraft,
} from "@/components/dashboard/PlanningCalendar";
import { PlanningEventDetailPanel } from "@/components/dashboard/PlanningEventDetailPanel";
import { PlanningNewEventDialog } from "@/components/dashboard/PlanningNewEventDialog";
import {
  PlanningSidebar,
  type PlanningSidebarFilters,
} from "@/components/dashboard/PlanningSidebar";
import {
  bureauCapabilities,
  coachedTeamsForViewer,
  teamsVisibleToViewer,
} from "@/lib/auth/bureauPermissions";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import { usePlanningChangeListener } from "@/lib/dashboard/usePlanningChangeListener";
import type { ClubEventView } from "@/lib/firebase/eventService";
import {
  dateOnly,
  getClubEvent,
  loadPlanningPageData,
} from "@/lib/firebase/eventService";
import type { PopoverAnchorRect } from "@/lib/planning/anchoredPopoverPosition";
import { findEventBlockAnchor } from "@/lib/planning/anchoredPopoverPosition";
import { buildGuestDirectoryFromPeople } from "@/lib/planning/eventGuestRows";
import { colorForFilter } from "@/lib/planning/calendarColors";
import { getLinkedMemberId } from "@/lib/firebase/memberService";
import { expandEventsToLabelBlocks } from "@/lib/planning/calendarEventBlocks";
import {
  arePlanningFiltersEqual,
  emptyPlanningFilters,
  readPlanningFilters,
  sanitizePlanningFilters,
  writePlanningFilters,
} from "@/lib/planning/planningFiltersStorage";
import {
  eventVisibleToRosterMember,
  viewerMatchIds,
} from "@/lib/teams/viewerTeamScope";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import styles from "./page.module.css";

/** Contenu page planning branché sur Firestore. */
function PlanningPageContent() {
  const { activeClub, activeClubRole, user } = useAuth();
  const caps = useMemo(
    () =>
      bureauCapabilities(activeClubRole, activeClub?.coachPermissions),
    [activeClubRole, activeClub?.coachPermissions],
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("eventId");
  const selectAllTeams = searchParams.get("teams") === "all";

  const [view, setView] = useState<CalendarView>("week");
  const [cursor, setCursor] = useState(() => dateOnly(new Date()));
  const [filters, setFilters] = useState<PlanningSidebarFilters>(emptyPlanningFilters);
  /** Club auquel `filters` appartient — évite d'écrire le state A sous la clé B. */
  const [filtersClubId, setFiltersClubId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ClubEventView | null>(null);
  const [selectedEventAnchor, setSelectedEventAnchor] =
    useState<PopoverAnchorRect | null>(null);
  const [selectedEventColor, setSelectedEventColor] = useState<string | null>(
    null,
  );
  const [createEventDraft, setCreateEventDraft] = useState<CreateEventDraft | null>(
    null,
  );
  const [linkedMemberId, setLinkedMemberId] = useState<string | null>(null);
  const [roleScopeReady, setRoleScopeReady] = useState(false);

  const range = useMemo(() => {
    const month = cursor.getMonth();
    const year = cursor.getFullYear();
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month + 2, 0),
    };
  }, [cursor]);

  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    (club) =>
      loadPlanningPageData(club.id, {
        start: range.start,
        end: range.end,
      }),
    [range.start.getTime(), range.end.getTime()],
  );

  /** Nettoie les query params deep-link après application (keep-alive). */
  function clearPlanningDeepLinkParams() {
    router.replace(pathname, { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    async function loadLinked() {
      if (!activeClub || !user) {
        setLinkedMemberId(null);
        return;
      }
      const id = await getLinkedMemberId(activeClub.id, user.uid);
      if (!cancelled) setLinkedMemberId(id);
    }
    void loadLinked();
    return () => {
      cancelled = true;
    };
  }, [activeClub?.id, user?.uid]);

  const viewerIds = useMemo(
    () =>
      viewerMatchIds({
        uid: user?.uid ?? null,
        memberId: linkedMemberId,
      }),
    [user?.uid, linkedMemberId],
  );

  const scopedTeams = useMemo(() => {
    if (!data) return [];
    return teamsVisibleToViewer({
      role: activeClubRole,
      uid: user?.uid ?? null,
      linkedMemberId,
      teams: data.teams,
    });
  }, [data, activeClubRole, user?.uid, linkedMemberId]);

  /** Équipes où le viewer peut créer (coach = entraînées, admin = toutes). */
  const creatableTeams = useMemo(() => {
    if (!data) return [];
    if (caps.isAdmin) return data.teams;
    if (caps.isCoach) {
      return coachedTeamsForViewer({
        role: activeClubRole,
        uid: user?.uid ?? null,
        linkedMemberId,
        teams: data.teams,
      });
    }
    return [];
  }, [
    data,
    caps.isAdmin,
    caps.isCoach,
    activeClubRole,
    user?.uid,
    linkedMemberId,
  ]);

  const scopedTeamIdSet = useMemo(
    () => new Set(scopedTeams.map((team) => team.id)),
    [scopedTeams],
  );

  const { hasNewEvents, resetFlag } = usePlanningChangeListener(
    activeClub?.id ?? null,
    scopedTeams.map((team) => team.id),
  );

  /** Recharge les données et acquitte le flag de changement. */
  function handleRefresh() {
    resetFlag();
    reload();
  }

  useEffect(() => {
    if (!activeClub) {
      setFilters(emptyPlanningFilters());
      setFiltersClubId(null);
      setRoleScopeReady(false);
      return;
    }
    setFilters(readPlanningFilters(activeClub.id));
    setFiltersClubId(activeClub.id);
    setRoleScopeReady(false);
  }, [activeClub?.id]);

  useEffect(() => {
    if (!activeClub || filtersClubId !== activeClub.id || !data) return;
    if (caps.isAdmin) {
      const sanitized = sanitizePlanningFilters(filters, {
        teamIds: new Set(data.teams.map((team) => team.id)),
        coachIds: new Set(data.coaches.map((coach) => coach.id)),
        categories: new Set(data.categories),
        playerIds: new Set(data.players.map((player) => player.id)),
      });
      if (!arePlanningFiltersEqual(filters, sanitized)) {
        setFilters(sanitized);
      }
      setRoleScopeReady(true);
      return;
    }

    const allowedTeamIds = scopedTeamIdSet;
    const nextTeamIds =
      filters.teamIds.length > 0
        ? filters.teamIds.filter((id) => allowedTeamIds.has(id))
        : [...allowedTeamIds];
    const forced: PlanningSidebarFilters = {
      teamIds:
        nextTeamIds.length > 0 ? nextTeamIds : [...allowedTeamIds],
      coachIds: [],
      categories: [],
      playerIds: [],
    };
    if (!arePlanningFiltersEqual(filters, forced)) {
      setFilters(forced);
    }
    setRoleScopeReady(true);
  }, [
    activeClub,
    data,
    filters,
    filtersClubId,
    caps.isAdmin,
    scopedTeamIdSet,
  ]);

  useEffect(() => {
    if (!activeClub || filtersClubId !== activeClub.id) return;
    writePlanningFilters(activeClub.id, filters);
  }, [activeClub, filters, filtersClubId]);

  const visibleEvents = useMemo(() => {
    if (!data) return [];
    if (caps.isAdmin) return data.events;
    return data.events.filter((event) =>
      eventVisibleToRosterMember({
        event,
        rosterTeamIds: scopedTeamIdSet,
        matchIds: viewerIds,
      }),
    );
  }, [data, caps.isAdmin, scopedTeamIdSet, viewerIds]);

  const eventBlocks = useMemo(() => {
    if (!data || !roleScopeReady) return [];
    return expandEventsToLabelBlocks(
      visibleEvents,
      scopedTeams,
      caps.isAdmin ? data.coaches : [],
      caps.isAdmin ? data.players : [],
      filters,
    );
  }, [data, filters, visibleEvents, scopedTeams, caps.isAdmin, roleScopeReady]);

  const guestDirectory = useMemo(() => {
    if (!data) return {};
    return buildGuestDirectoryFromPeople([
      ...data.players,
      ...data.coaches,
      ...data.admins,
    ]);
  }, [data]);

  /** Garde le popover ouvert synchronisé après un reload RSVP. */
  useEffect(() => {
    if (!selectedEvent) return;
    const fresh = visibleEvents.find((event) => event.id === selectedEvent.id);
    if (!fresh) return;
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
  }, [visibleEvents, selectedEvent]);

  useEffect(() => {
    if (!data || !selectAllTeams || !roleScopeReady) return;
    if (initialEventId) return;

    setView("week");
    setFilters({
      teamIds: scopedTeams.map((team) => team.id),
      coachIds: [],
      categories: [],
      playerIds: [],
    });
    clearPlanningDeepLinkParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear once per searchParams token
  }, [data, selectAllTeams, initialEventId, pathname, roleScopeReady, scopedTeams]);

  useEffect(() => {
    if (!data || !initialEventId || !activeClub || !roleScopeReady) return;

    let cancelled = false;

    async function applyEventDeepLink() {
      let matchedEvent =
        visibleEvents.find((event) => event.id === initialEventId) ?? null;

      if (!matchedEvent) {
        matchedEvent = await getClubEvent(
          activeClub!.id,
          initialEventId!,
          data!.teams,
        );
        if (cancelled) return;
        if (!matchedEvent) {
          clearPlanningDeepLinkParams();
          return;
        }
        if (!caps.isAdmin) {
          const allowed = eventVisibleToRosterMember({
            event: matchedEvent,
            rosterTeamIds: scopedTeamIdSet,
            matchIds: viewerIds,
          });
          if (!allowed) {
            clearPlanningDeepLinkParams();
            return;
          }
        }
      }

      const eventDay = dateOnly(new Date(matchedEvent.startsAt));
      setCursor(eventDay);
      setView("week");
      setSelectedEvent(matchedEvent);
      setSelectedEventAnchor(null);
      setSelectedEventColor(
        matchedEvent.teamIds[0]
          ? colorForFilter("team", matchedEvent.teamIds[0])
          : null,
      );
      setFilters({
        teamIds:
          matchedEvent.teamIds.length > 0
            ? matchedEvent.teamIds.filter((id) => scopedTeamIdSet.has(id))
            : scopedTeams.map((team) => team.id),
        coachIds: [],
        categories: [],
        playerIds: [],
      });
      clearPlanningDeepLinkParams();
      // Ancre après paint du calendrier (bloc visible).
      requestAnimationFrame(() => {
        if (cancelled) return;
        setSelectedEventAnchor(findEventBlockAnchor(matchedEvent.id));
      });
    }

    void applyEventDeepLink();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply once per eventId query
  }, [
    data,
    initialEventId,
    activeClub?.id,
    pathname,
    roleScopeReady,
    visibleEvents,
    scopedTeamIdSet,
    scopedTeams,
    caps.isAdmin,
    viewerIds,
  ]);

  const createEventPeople = useMemo(() => {
    if (!data) return [];
    if (caps.isCoach) {
      const people = [...data.players, ...data.coaches].filter((person) =>
        person.matchIds.some((id) => {
          for (const team of creatableTeams) {
            if (
              team.playerIds.includes(id) ||
              team.coachIds.includes(id)
            ) {
              return true;
            }
          }
          return false;
        }),
      );
      return people.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    }
    return [...data.players, ...data.coaches, ...data.admins].sort((a, b) =>
      a.name.localeCompare(b.name, "fr"),
    );
  }, [data, caps.isCoach, creatableTeams]);

  function openCreateForDay(day: Date) {
    if (!caps.canCreateEvent) return;
    setCreateEventDraft({
      day,
      startTime: "18:00",
      endTime: "19:30",
      anchor: {
        left: 16,
        top: 120,
        right: 270,
        bottom: 180,
      },
    });
  }

  if (loading && !data) {
    return <DashboardSkeleton variant="planning" />;
  }

  return (
    <div className={styles.pageRoot}>
      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <div
          className={`${styles.layout}${refreshing ? ` ${transitionStyles.refreshing}` : ""}`}
        >
          <PlanningSidebar
            cursor={cursor}
            selectedDay={cursor}
            teams={scopedTeams}
            coaches={caps.isAdmin ? data.coaches : []}
            players={caps.isAdmin ? data.players : []}
            categories={
              caps.isAdmin
                ? data.categories
                : Array.from(
                    new Set(
                      scopedTeams
                        .map((team) => team.category.trim())
                        .filter(Boolean),
                    ),
                  ).sort((a, b) => a.localeCompare(b, "fr"))
            }
            filters={filters}
            onFiltersChange={(next) => {
              if (caps.isAdmin) {
                setFilters(next);
                return;
              }
              setFilters({
                teamIds: next.teamIds.filter((id) => scopedTeamIdSet.has(id)),
                coachIds: [],
                categories: [],
                playerIds: [],
              });
            }}
            onCursorChange={setCursor}
            onDaySelect={(day) => {
              setCursor(day);
              setView("day");
            }}
            onCreateClick={() => openCreateForDay(cursor)}
            canCreate={caps.canCreateEvent}
            teamsOnlyFilters={caps.isPlayer}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            hasNewData={hasNewEvents}
            accentColor={activeClub?.brandColorHex?.split("+")?.[0] ?? undefined}
          />

          <div className={styles.mainPane}>
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
              onCreateEvent={
                caps.canCreateEvent
                  ? setCreateEventDraft
                  : () => undefined
              }
              pendingCreate={caps.canCreateEvent ? createEventDraft : null}
            />
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <PlanningEventDetailPanel
          event={selectedEvent}
          anchor={selectedEventAnchor}
          eventColor={selectedEventColor}
          teams={scopedTeams}
          guestDirectory={guestDirectory}
          onClose={() => {
            setSelectedEvent(null);
            setSelectedEventAnchor(null);
            setSelectedEventColor(null);
          }}
          clubId={activeClub && linkedMemberId ? activeClub.id : undefined}
          linkedMemberId={linkedMemberId}
          onRsvpUpdated={reload}
        />
      ) : null}

      {createEventDraft &&
      activeClub &&
      user &&
      caps.canCreateEvent ? (
        <PlanningNewEventDialog
          day={createEventDraft.day}
          initialStartTime={createEventDraft.startTime}
          initialEndTime={createEventDraft.endTime}
          anchor={createEventDraft.anchor}
          clubId={activeClub.id}
          creatorId={user.uid}
          teams={creatableTeams}
          categories={
            caps.isAdmin
              ? (data?.categories ?? [])
              : Array.from(
                  new Set(
                    creatableTeams
                      .map((team) => team.category.trim())
                      .filter(Boolean),
                  ),
                ).sort((a, b) => a.localeCompare(b, "fr"))
          }
          people={createEventPeople}
          seasonEndDate={data?.seasonEndDate ?? null}
          onClose={() => setCreateEventDraft(null)}
          onCreated={reload}
        />
      ) : null}
    </div>
  );
}

/** Client planning (Suspense pour searchParams). */
export function PlanningPageClient() {
  return (
    <Suspense
      fallback={
        <div className={styles.pageRoot}>
          <DashboardSkeleton variant="planning" />
        </div>
      }
    >
      <PlanningPageContent />
    </Suspense>
  );
}
