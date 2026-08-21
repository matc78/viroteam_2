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
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import type { ClubEventView } from "@/lib/firebase/eventService";
import {
  dateOnly,
  getClubEvent,
  loadPlanningPageData,
} from "@/lib/firebase/eventService";
import { expandEventsToLabelBlocks } from "@/lib/planning/calendarEventBlocks";
import {
  arePlanningFiltersEqual,
  emptyPlanningFilters,
  readPlanningFilters,
  sanitizePlanningFilters,
  writePlanningFilters,
} from "@/lib/planning/planningFiltersStorage";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import styles from "./page.module.css";

/** Contenu page planning branché sur Firestore. */
function PlanningPageContent() {
  const { activeClub, user } = useAuth();
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
  const [createEventDraft, setCreateEventDraft] = useState<CreateEventDraft | null>(
    null,
  );

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
    if (!activeClub) {
      setFilters(emptyPlanningFilters());
      setFiltersClubId(null);
      return;
    }
    setFilters(readPlanningFilters(activeClub.id));
    setFiltersClubId(activeClub.id);
  }, [activeClub?.id]);

  useEffect(() => {
    if (!activeClub || filtersClubId !== activeClub.id || !data) return;
    const sanitized = sanitizePlanningFilters(filters, {
      teamIds: new Set(data.teams.map((team) => team.id)),
      coachIds: new Set(data.coaches.map((coach) => coach.id)),
      categories: new Set(data.categories),
      playerIds: new Set(data.players.map((player) => player.id)),
    });
    if (!arePlanningFiltersEqual(filters, sanitized)) {
      setFilters(sanitized);
    }
  }, [activeClub, data, filters, filtersClubId]);

  useEffect(() => {
    if (!activeClub || filtersClubId !== activeClub.id) return;
    writePlanningFilters(activeClub.id, filters);
  }, [activeClub, filters, filtersClubId]);

  const eventBlocks = useMemo(() => {
    if (!data) return [];
    return expandEventsToLabelBlocks(
      data.events,
      data.teams,
      data.coaches,
      data.players,
      filters,
    );
  }, [data, filters]);

  useEffect(() => {
    if (!data || !selectAllTeams) return;
    if (initialEventId) return;

    setView("week");
    setFilters({
      teamIds: data.teams.map((team) => team.id),
      coachIds: [],
      categories: [],
      playerIds: [],
    });
    clearPlanningDeepLinkParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear once per searchParams token
  }, [data, selectAllTeams, initialEventId, pathname]);

  useEffect(() => {
    if (!data || !initialEventId || !activeClub) return;

    let cancelled = false;

    async function applyEventDeepLink() {
      let matchedEvent =
        data!.events.find((event) => event.id === initialEventId) ?? null;

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
      }

      const eventDay = dateOnly(new Date(matchedEvent.startsAt));
      setCursor(eventDay);
      setView("week");
      setSelectedEvent(matchedEvent);
      setFilters({
        teamIds:
          matchedEvent.teamIds.length > 0
            ? [...matchedEvent.teamIds]
            : data!.teams.map((team) => team.id),
        coachIds: [],
        categories: [],
        playerIds: [],
      });
      clearPlanningDeepLinkParams();
    }

    void applyEventDeepLink();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply once per eventId query
  }, [data, initialEventId, activeClub?.id, pathname]);

  const createEventPeople = useMemo(
    () =>
      [...(data?.players ?? []), ...(data?.coaches ?? []), ...(data?.admins ?? [])].sort(
        (a, b) => a.name.localeCompare(b.name, "fr"),
      ),
    [data?.players, data?.coaches, data?.admins],
  );

  function openCreateForDay(day: Date) {
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
            teams={data.teams}
            coaches={data.coaches}
            players={data.players}
            categories={data.categories}
            filters={filters}
            onFiltersChange={setFilters}
            onCursorChange={setCursor}
            onDaySelect={(day) => {
              setCursor(day);
              setView("day");
            }}
            onCreateClick={() => openCreateForDay(cursor)}
            onRefresh={reload}
            refreshing={refreshing}
          />

          <div className={styles.mainPane}>
            <PlanningCalendar
              eventBlocks={eventBlocks}
              view={view}
              cursor={cursor}
              onViewChange={setView}
              onCursorChange={setCursor}
              onSelectDay={setCursor}
              onSelectEvent={setSelectedEvent}
              onCreateEvent={setCreateEventDraft}
              pendingCreate={createEventDraft}
            />
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <PlanningEventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      ) : null}

      {createEventDraft && activeClub && user ? (
        <PlanningNewEventDialog
          day={createEventDraft.day}
          initialStartTime={createEventDraft.startTime}
          initialEndTime={createEventDraft.endTime}
          anchor={createEventDraft.anchor}
          clubId={activeClub.id}
          creatorId={user.uid}
          teams={data?.teams ?? []}
          categories={data?.categories ?? []}
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
