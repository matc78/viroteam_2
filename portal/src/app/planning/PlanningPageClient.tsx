"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardGuard } from "@/components/auth/DashboardGuard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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
import styles from "./page.module.css";

/** Contenu page planning branché sur Firestore. */
function PlanningPageContent() {
  const { activeClub, user } = useAuth();
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("eventId");

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

  const { data, loading, error, reload } = useAsyncClubResource(
    activeClub,
    (club) =>
      loadPlanningPageData(club.id, {
        start: range.start,
        end: range.end,
      }),
    [range.start.getTime(), range.end.getTime()],
  );

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
    if (!data || !initialEventId) return;
    const matchedEvent = data.events.find((event) => event.id === initialEventId);
    if (!matchedEvent) return;
    setCursor(dateOnly(new Date(matchedEvent.startsAt)));
    setView("day");
    setSelectedEvent(matchedEvent);
  }, [data, initialEventId]);

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

  return (
    <DashboardShell wide>
      {loading && !data ? (
        <p className={introStyles.lead}>Chargement du planning…</p>
      ) : null}

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className={styles.layout}>
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
          />

          <div className={styles.mainPane}>
            <PlanningCalendar
              eventBlocks={eventBlocks}
              view={view}
              cursor={cursor}
              selectedTeamId="all"
              selectedType="all"
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
    </DashboardShell>
  );
}

/** Client planning + garde admin. */
export function PlanningPageClient() {
  return (
    <DashboardGuard>
      <Suspense
        fallback={<p className={introStyles.lead}>Chargement du planning…</p>}
      >
        <PlanningPageContent />
      </Suspense>
    </DashboardGuard>
  );
}
