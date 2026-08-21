"use client";

import {
  AnimatePresence,
  motion,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ClubEventView } from "@/lib/firebase/eventService";
import {
  buildMonthGrid,
  buildWeekDays,
  dateOnly,
  eventTypeLabel,
  formatCalendarPeriodLabel,
  formatDateId,
  formatEventTime,
} from "@/lib/firebase/eventService";
import type { CalendarEventBlock } from "@/lib/planning/calendarEventBlocks";
import {
  overlappingClusterIds,
  packOverlappingEvents,
} from "@/lib/planning/eventOverlapLayout";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import styles from "./PlanningCalendar.module.css";

export type CalendarView = "month" | "week" | "day";

/** Brouillon de création d'événement (jour + plage horaire). */
export type CreateEventDraft = {
  day: Date;
  startTime: string;
  endTime: string;
  /** Rectangle d'ancrage (sélection / cellule) en coordonnées viewport. */
  anchor: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
};

/** Props du calendrier planning style agenda. */
type PlanningCalendarProps = {
  /** Blocs agenda (1 événement × N labels sélectionnés). */
  eventBlocks: CalendarEventBlock[];
  view: CalendarView;
  cursor: Date;
  onViewChange: (view: CalendarView) => void;
  onCursorChange: (cursor: Date) => void;
  onSelectEvent: (event: ClubEventView) => void;
  onSelectDay: (day: Date) => void;
  /** Ouverture création d'événement (mois / semaine / jour). */
  onCreateEvent: (draft: CreateEventDraft) => void;
  /** Brouillon ouvert : conserve le fantôme de sélection. */
  pendingCreate?: CreateEventDraft | null;
};

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOUR_START = 0;
const HOUR_END = 24;
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START },
  (_, index) => HOUR_START + index,
);
const SLOT_MINUTES = 15;
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;
const DEFAULT_CLICK_DURATION_MINUTES = 60;
const DEFAULT_MONTH_START = "18:00";
const DEFAULT_MONTH_END = "19:30";
/** Hauteur d'une heure (alignée sur `.hourLabels` / `.dayColumns` CSS). */
const HOUR_ROW_REM = 3.2;

/** Minutes depuis minuit pour un ISO datetime. */
function minutesFromIso(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

/** Style couleur d'un bloc agenda (label ou fallback). */
function blockColorStyle(block: CalendarEventBlock): CSSProperties {
  return {
    "--event-color": block.color,
  } as CSSProperties;
}

function isSameDay(a: Date, b: Date): boolean {
  return formatDateId(a) === formatDateId(b);
}

function blocksForDay(
  blocks: CalendarEventBlock[],
  day: Date,
): CalendarEventBlock[] {
  return blocks.filter((block) =>
    isSameDay(dateOnly(new Date(block.event.startsAt)), day),
  );
}

function shiftCursor(cursor: Date, view: CalendarView, direction: -1 | 1): Date {
  const next = new Date(cursor);
  if (view === "month") {
    next.setMonth(next.getMonth() + direction);
    return dateOnly(new Date(next.getFullYear(), next.getMonth(), 1));
  }
  if (view === "week") {
    next.setDate(next.getDate() + direction * 7);
    return dateOnly(next);
  }
  next.setDate(next.getDate() + direction);
  return dateOnly(next);
}

/** Convertit des minutes depuis HOUR_START en `HH:mm`. */
function minutesToTimeLabel(minutesFromStart: number): string {
  const totalMinutes = HOUR_START * 60 + minutesFromStart;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Snappe une position Y de colonne vers un créneau de 15 minutes. */
function snapPointerToMinutes(
  clientY: number,
  columnTop: number,
  columnHeight: number,
): number {
  if (columnHeight <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (clientY - columnTop) / columnHeight));
  const rawMinutes = ratio * TOTAL_MINUTES;
  const snapped =
    Math.floor(rawMinutes / SLOT_MINUTES) * SLOT_MINUTES;
  return Math.min(TOTAL_MINUTES - SLOT_MINUTES, Math.max(0, snapped));
}

type SelectionRange = {
  dayKey: string;
  startMinutes: number;
  endMinutes: number;
};

/** Calendrier fluide mois / semaine / jour (style agenda). */
export function PlanningCalendar({
  eventBlocks,
  view,
  cursor,
  onViewChange,
  onCursorChange,
  onSelectEvent,
  onSelectDay,
  onCreateEvent,
  pendingCreate = null,
}: PlanningCalendarProps) {
  const today = dateOnly(new Date());
  const periodLabel = formatCalendarPeriodLabel(cursor, view);
  const motionKey = `${view}-${formatDateId(cursor)}`;
  const [scrollToNowNonce, setScrollToNowNonce] = useState(0);

  function goToToday() {
    onCursorChange(dateOnly(new Date()));
    if (view === "month") onViewChange("week");
    setScrollToNowNonce((current) => current + 1);
  }

  return (
    <section className={styles.calendar} aria-label="Calendrier planning">
      <header className={styles.toolbar}>
        <div className={styles.navGroup}>
          <button
            type="button"
            className={styles.todayButton}
            onClick={goToToday}
          >
            Aujourd&apos;hui
          </button>
          <div className={styles.arrowGroup}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Période précédente"
              onClick={() => onCursorChange(shiftCursor(cursor, view, -1))}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Période suivante"
              onClick={() => onCursorChange(shiftCursor(cursor, view, 1))}
            >
              ›
            </button>
          </div>
          <h2 className={styles.periodLabel}>{periodLabel}</h2>
        </div>

        <div className={styles.viewSwitch} role="group" aria-label="Mode d'affichage">
          {(
            [
              { id: "month", label: "Mois" },
              { id: "week", label: "Semaine" },
              { id: "day", label: "Jour" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.viewButton}
              data-active={view === option.id ? "true" : "false"}
              aria-pressed={view === option.id}
              onClick={() => onViewChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.viewport}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={motionKey}
            className={styles.viewPane}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {view === "month" ? (
              <MonthView
                cursor={cursor}
                today={today}
                eventBlocks={eventBlocks}
                pendingDayKey={
                  pendingCreate ? formatDateId(pendingCreate.day) : null
                }
                onSelectDay={(day, anchor) =>
                  onCreateEvent({
                    day,
                    startTime: DEFAULT_MONTH_START,
                    endTime: DEFAULT_MONTH_END,
                    anchor,
                  })
                }
                onSelectEvent={onSelectEvent}
              />
            ) : null}

            {view === "week" ? (
              <TimeGridView
                days={buildWeekDays(cursor)}
                today={today}
                eventBlocks={eventBlocks}
                pendingCreate={pendingCreate}
                scrollToNowNonce={scrollToNowNonce}
                onSelectDay={(day) => {
                  onSelectDay(day);
                  onCursorChange(day);
                  onViewChange("day");
                }}
                onSelectEvent={onSelectEvent}
                onCreateEvent={onCreateEvent}
              />
            ) : null}

            {view === "day" ? (
              <TimeGridView
                days={[dateOnly(cursor)]}
                today={today}
                eventBlocks={eventBlocks}
                pendingCreate={pendingCreate}
                scrollToNowNonce={scrollToNowNonce}
                onSelectDay={onSelectDay}
                onSelectEvent={onSelectEvent}
                onCreateEvent={onCreateEvent}
                singleDay
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/** Convertit `HH:mm` en minutes depuis HOUR_START. */
function timeLabelToMinutesFromStart(label: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(label);
  if (!match) return 0;
  const total = Number(match[1]) * 60 + Number(match[2]);
  return Math.min(
    TOTAL_MINUTES,
    Math.max(0, total - HOUR_START * 60),
  );
}

function buildAnchorFromColumn(
  column: HTMLElement,
  startMinutes: number,
  endMinutes: number,
): CreateEventDraft["anchor"] {
  const rect = column.getBoundingClientRect();
  const top = rect.top + (startMinutes / TOTAL_MINUTES) * rect.height;
  const bottom = rect.top + (endMinutes / TOTAL_MINUTES) * rect.height;
  return {
    left: rect.left,
    top,
    right: rect.right,
    bottom: Math.max(bottom, top + 8),
  };
}

type MonthViewProps = {
  cursor: Date;
  today: Date;
  eventBlocks: CalendarEventBlock[];
  pendingDayKey: string | null;
  onSelectDay: (day: Date, anchor: CreateEventDraft["anchor"]) => void;
  onSelectEvent: (event: ClubEventView) => void;
};

function MonthView({
  cursor,
  today,
  eventBlocks,
  pendingDayKey,
  onSelectDay,
  onSelectEvent,
}: MonthViewProps) {
  const days = buildMonthGrid(cursor);
  const currentMonth = cursor.getMonth();
  const monthScrollRef = useRef<HTMLDivElement>(null);

  return (
    <FadeScrollArea
      className={styles.monthGridWrap}
      viewportClassName={styles.monthGrid}
      scrollRef={monthScrollRef}
    >
      <div className={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className={styles.weekdayCell}>
            {label}
          </div>
        ))}
      </div>
      <div className={styles.monthBody}>
        {days.map((day) => {
          const dayBlocks = blocksForDay(eventBlocks, day);
          const inMonth = day.getMonth() === currentMonth;
          const isToday = isSameDay(day, today);
          const dayKey = formatDateId(day);
          const visibleBlocks = dayBlocks.slice(0, 3);
          const overflow = dayBlocks.length - visibleBlocks.length;

          return (
            <div
              key={dayKey}
              className={styles.monthCell}
              data-outside={inMonth ? "false" : "true"}
              data-today={isToday ? "true" : "false"}
              data-pending={pendingDayKey === dayKey ? "true" : "false"}
              role="button"
              tabIndex={0}
              onClick={(mouseEvent) => {
                const rect = (
                  mouseEvent.currentTarget as HTMLElement
                ).getBoundingClientRect();
                onSelectDay(day, {
                  left: rect.left,
                  top: rect.top,
                  right: rect.right,
                  bottom: rect.bottom,
                });
              }}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                  keyboardEvent.preventDefault();
                  const rect = (
                    keyboardEvent.currentTarget as HTMLElement
                  ).getBoundingClientRect();
                  onSelectDay(day, {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                  });
                }
              }}
            >
              <span className={styles.monthDayNumber}>{day.getDate()}</span>
              <div className={styles.monthEvents}>
                {visibleBlocks.map((block) => {
                  const displayTitle = formatEventBlockTitle(block.event);
                  return (
                  <button
                    key={block.blockId}
                    type="button"
                    className={styles.monthChip}
                    data-colored="true"
                    style={blockColorStyle(block)}
                    title={`${formatEventTime(block.event.startsAt)} · ${displayTitle}`}
                    onClick={(mouseEvent) => {
                      mouseEvent.stopPropagation();
                      onSelectEvent(block.event);
                    }}
                  >
                    <span className={styles.monthChipTime}>
                      {formatEventTime(block.event.startsAt)}
                    </span>
                    <span className={styles.monthChipTitle}>{displayTitle}</span>
                  </button>
                  );
                })}
                {overflow > 0 ? (
                  <span className={styles.monthMore}>+{overflow}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </FadeScrollArea>
  );
}

type TimeGridViewProps = {
  days: Date[];
  today: Date;
  eventBlocks: CalendarEventBlock[];
  pendingCreate?: CreateEventDraft | null;
  /** Incrémente pour recentrer sur l'heure actuelle (ex. bouton Aujourd'hui). */
  scrollToNowNonce?: number;
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: ClubEventView) => void;
  onCreateEvent: (draft: CreateEventDraft) => void;
  singleDay?: boolean;
};

type DragSession = {
  day: Date;
  dayKey: string;
  originMinutes: number;
  currentMinutes: number;
  pointerId: number;
  moved: boolean;
};

function TimeGridView({
  days,
  today,
  eventBlocks,
  pendingCreate = null,
  scrollToNowNonce = 0,
  onSelectDay,
  onSelectEvent,
  onCreateEvent,
  singleDay = false,
}: TimeGridViewProps) {
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [now, setNow] = useState(() => new Date());
  const dragRef = useRef<DragSession | null>(null);
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    setSelection(null);
  }, []);

  /** Centre le viewport verticalement sur l'heure courante. */
  const scrollToCurrentTime = useCallback((instant = false) => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const rootFontSize = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize || "16",
    );
    const hourHeightPx =
      HOUR_ROW_REM * (Number.isFinite(rootFontSize) ? rootFontSize : 16);
    const header = scrollElement.querySelector<HTMLElement>(
      `.${styles.timeGridHeader}`,
    );
    const headerHeight = header?.offsetHeight ?? 0;
    const current = new Date();
    const minutes = current.getHours() * 60 + current.getMinutes();
    const offsetInBody =
      (minutes / TOTAL_MINUTES) * (hourHeightPx * (HOUR_END - HOUR_START));
    const target =
      headerHeight + offsetInBody - scrollElement.clientHeight / 2;

    scrollElement.scrollTo({
      top: Math.max(0, target),
      behavior: instant ? "auto" : "smooth",
    });
  }, []);

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      scrollToCurrentTime(scrollToNowNonce === 0);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [scrollToCurrentTime, scrollToNowNonce, days.length, singleDay]);

  useEffect(() => {
    function tick() {
      setNow(new Date());
    }
    const msToNextMinute =
      (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    const timeoutId = window.setTimeout(() => {
      tick();
    }, Math.max(msToNextMinute, 0));
    const intervalId = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  const nowTopPercent = useMemo(() => {
    const minutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    if (minutes < 0 || minutes > TOTAL_MINUTES) return null;
    return (minutes / TOTAL_MINUTES) * 100;
  }, [now]);

  const todayLive = dateOnly(now);
  const showNowIndicator = days.some((day) => isSameDay(day, todayLive));

  useEffect(() => {
    function onWindowPointerUp(pointerEvent: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || pointerEvent.pointerId !== drag.pointerId) return;

      const startMinutes = Math.min(drag.originMinutes, drag.currentMinutes);
      let endMinutes =
        Math.max(drag.originMinutes, drag.currentMinutes) + SLOT_MINUTES;
      if (!drag.moved) {
        endMinutes = Math.min(
          startMinutes + DEFAULT_CLICK_DURATION_MINUTES,
          TOTAL_MINUTES,
        );
      }
      if (endMinutes <= startMinutes) {
        endMinutes = Math.min(startMinutes + SLOT_MINUTES, TOTAL_MINUTES);
      }

      const column = columnRefs.current.get(drag.dayKey);
      const anchor = column
        ? buildAnchorFromColumn(column, startMinutes, endMinutes)
        : {
            left: pointerEvent.clientX,
            top: pointerEvent.clientY,
            right: pointerEvent.clientX,
            bottom: pointerEvent.clientY,
          };

      onCreateEvent({
        day: drag.day,
        startTime: minutesToTimeLabel(startMinutes),
        endTime: minutesToTimeLabel(endMinutes),
        anchor,
      });
      clearDrag();
    }

    function onWindowPointerCancel(pointerEvent: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || pointerEvent.pointerId !== drag.pointerId) return;
      clearDrag();
    }

    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerCancel);
    return () => {
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
    };
  }, [clearDrag, onCreateEvent]);

  function updateDragFromClientY(clientY: number) {
    const drag = dragRef.current;
    if (!drag) return;
    const column = columnRefs.current.get(drag.dayKey);
    if (!column) return;
    const rect = column.getBoundingClientRect();
    const currentMinutes = snapPointerToMinutes(clientY, rect.top, rect.height);
    if (currentMinutes !== drag.currentMinutes) {
      drag.currentMinutes = currentMinutes;
      if (currentMinutes !== drag.originMinutes) drag.moved = true;
      const startMinutes = Math.min(drag.originMinutes, currentMinutes);
      const endMinutes =
        Math.max(drag.originMinutes, currentMinutes) + SLOT_MINUTES;
      setSelection({
        dayKey: drag.dayKey,
        startMinutes,
        endMinutes,
      });
    }
  }

  function handleColumnPointerDown(
    day: Date,
    pointerEvent: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (pointerEvent.button !== 0) return;
    const target = pointerEvent.target as HTMLElement;
    if (target.closest(`.${styles.eventBlock}`)) return;

    const dayKey = formatDateId(day);
    const column = columnRefs.current.get(dayKey);
    if (!column) return;
    const rect = column.getBoundingClientRect();
    const originMinutes = snapPointerToMinutes(
      pointerEvent.clientY,
      rect.top,
      rect.height,
    );

    dragRef.current = {
      day,
      dayKey,
      originMinutes,
      currentMinutes: originMinutes,
      pointerId: pointerEvent.pointerId,
      moved: false,
    };
    setSelection({
      dayKey,
      startMinutes: originMinutes,
      endMinutes: originMinutes + SLOT_MINUTES,
    });
    column.setPointerCapture(pointerEvent.pointerId);
    pointerEvent.preventDefault();
  }

  function handleColumnPointerMove(
    pointerEvent: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!dragRef.current) return;
    updateDragFromClientY(pointerEvent.clientY);
  }

  const pendingDayKey = pendingCreate ? formatDateId(pendingCreate.day) : null;
  const pendingSelection =
    pendingCreate && pendingDayKey
      ? {
          dayKey: pendingDayKey,
          startMinutes: timeLabelToMinutesFromStart(pendingCreate.startTime),
          endMinutes: timeLabelToMinutesFromStart(pendingCreate.endTime),
        }
      : null;

  return (
    <div
      className={styles.timeGrid}
      data-single={singleDay ? "true" : "false"}
      data-selecting={selection || pendingSelection ? "true" : "false"}
      style={{ ["--day-count" as string]: String(days.length) }}
    >
      <FadeScrollArea
        className={styles.timeGridScrollWrap}
        viewportClassName={styles.timeGridScroll}
        scrollRef={scrollRef}
      >
          <div className={styles.timeGridHeader}>
            <div className={styles.timeGutterSpacer} aria-hidden="true" />
            {days.map((day) => {
              const isToday = isSameDay(day, today);
              const weekday = new Intl.DateTimeFormat("fr-FR", {
                weekday: "short",
              }).format(day);
              return (
                <button
                  key={formatDateId(day)}
                  type="button"
                  className={styles.dayHeader}
                  data-today={isToday ? "true" : "false"}
                  onClick={() => onSelectDay(day)}
                >
                  <span className={styles.dayHeaderWeekday}>{weekday}</span>
                  <span className={styles.dayHeaderNumber}>{day.getDate()}</span>
                </button>
              );
            })}
          </div>

        <div className={styles.timeGridBody}>
          <div className={styles.hourLabels}>
            {HOURS.map((hour) => (
              <div key={hour} className={styles.hourLabel}>
                {`${String(hour).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          <div className={styles.dayColumns}>
            {days.map((day) => {
              const dayKey = formatDateId(day);
              const dayBlocks = blocksForDay(eventBlocks, day);
              const daySelection =
                selection?.dayKey === dayKey
                  ? selection
                  : pendingSelection?.dayKey === dayKey
                    ? pendingSelection
                    : null;

              return (
                <div
                  key={dayKey}
                  ref={(element) => {
                    if (element) columnRefs.current.set(dayKey, element);
                    else columnRefs.current.delete(dayKey);
                  }}
                  className={styles.dayColumn}
                  data-today={isSameDay(day, today) ? "true" : "false"}
                  onPointerDown={(pointerEvent) =>
                    handleColumnPointerDown(day, pointerEvent)
                  }
                  onPointerMove={handleColumnPointerMove}
                >
                  {HOURS.map((hour) => (
                    <div key={hour} className={styles.hourSlot} />
                  ))}

                  {showNowIndicator &&
                  isSameDay(day, todayLive) &&
                  nowTopPercent !== null ? (
                    <div
                      className={styles.nowIndicator}
                      style={{ top: `${nowTopPercent}%` }}
                      aria-hidden="true"
                    >
                      <span className={styles.nowDot} />
                      <span className={styles.nowLine} />
                    </div>
                  ) : null}

                  {daySelection ? (
                    <div
                      className={styles.selectionGhost}
                      style={{
                        top: `${(daySelection.startMinutes / TOTAL_MINUTES) * 100}%`,
                        height: `${((daySelection.endMinutes - daySelection.startMinutes) / TOTAL_MINUTES) * 100}%`,
                      }}
                    >
                      <span className={styles.selectionGhostLabel}>
                        {minutesToTimeLabel(daySelection.startMinutes)}
                        {" – "}
                        {minutesToTimeLabel(daySelection.endMinutes)}
                      </span>
                    </div>
                  ) : null}

                  <DayColumnEvents
                    eventBlocks={dayBlocks}
                    singleDay={singleDay}
                    onSelectEvent={onSelectEvent}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </FadeScrollArea>
    </div>
  );
}

type DayColumnEventsProps = {
  eventBlocks: CalendarEventBlock[];
  singleDay: boolean;
  onSelectEvent: (event: ClubEventView) => void;
};

/** Libellé affiché dans un bloc agenda (ex. « Entraînement - M18 »). */
function formatEventBlockTitle(event: ClubEventView): string {
  if (event.type === "other") {
    return event.title.trim() || eventTypeLabel(event.type);
  }
  const typeLabel = eventTypeLabel(event.type);
  const teamLabel =
    event.teamLabels.find((label) => label && label !== "Club") ??
    (event.title.trim() && event.title.trim() !== typeLabel
      ? event.title.trim()
      : null);
  if (teamLabel) return `${typeLabel} - ${teamLabel}`;
  return event.title.trim() || typeLabel;
}

/** Blocs horaires d'une journée, packés en cascade chevauchée (style Google). */
function DayColumnEvents({
  eventBlocks,
  singleDay,
  onSelectEvent,
}: DayColumnEventsProps) {
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const hoverClearFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverClearFrameRef.current !== null) {
        cancelAnimationFrame(hoverClearFrameRef.current);
      }
    };
  }, []);

  const packed = useMemo(
    () =>
      packOverlappingEvents(
        eventBlocks.map((block) => {
          const startMinutes = Math.max(
            0,
            Math.min(TOTAL_MINUTES - 15, minutesFromIso(block.event.startsAt)),
          );
          const rawEnd = minutesFromIso(block.event.endsAt);
          const endMinutes = Math.max(
            startMinutes + 30,
            Math.min(TOTAL_MINUTES, rawEnd),
          );
          return {
            id: block.blockId,
            startMinutes,
            endMinutes,
          };
        }),
      ),
    [eventBlocks],
  );

  const layoutById = useMemo(
    () => new Map(packed.map((item) => [item.id, item])),
    [packed],
  );

  const hoverClusterIds = useMemo(() => {
    if (!hoveredBlockId) return null;
    return overlappingClusterIds(hoveredBlockId, packed);
  }, [hoveredBlockId, packed]);

  const hoverLayout = useMemo(() => {
    if (!hoveredBlockId || !hoverClusterIds) return null;
    const hovered = layoutById.get(hoveredBlockId);
    if (!hovered) return null;

    const leftPeekIds = packed
      .filter(
        (item) =>
          hoverClusterIds.has(item.id) && item.column < hovered.column,
      )
      .sort((a, b) => a.column - b.column)
      .map((item) => item.id);

    const rightPeekIds = packed
      .filter(
        (item) =>
          hoverClusterIds.has(item.id) && item.column > hovered.column,
      )
      .sort((a, b) => a.column - b.column)
      .map((item) => item.id);

    return { leftPeekIds, rightPeekIds };
  }, [hoveredBlockId, hoverClusterIds, layoutById, packed]);

  return (
    <>
      {eventBlocks.map((block) => {
        const layout = layoutById.get(block.blockId);
        if (!layout) return null;
        const event = block.event;
        const top = (layout.startMinutes / TOTAL_MINUTES) * 100;
        const durationMinutes = layout.endMinutes - layout.startMinutes;
        const height = (durationMinutes / TOTAL_MINUTES) * 100;
        const isStacked = layout.columnCount > 1;
        const isInHoverCluster =
          hoverClusterIds?.has(block.blockId) === true && isStacked;
        const stackSize =
          isInHoverCluster && hoverLayout
            ? 1 + hoverLayout.leftPeekIds.length + hoverLayout.rightPeekIds.length
            : layout.columnCount;
        const peekPercent =
          stackSize <= 1 ? 0 : Math.min(18, 90 / stackSize);

        let leftPercent = layout.column * peekPercent;
        let widthPercent = 100 - leftPercent;
        let isFrontmost = layout.column === layout.columnCount - 1;
        let zIndex = 2 + layout.column;
        let peekSide: "left" | "right" | null = null;

        if (isInHoverCluster && hoverLayout) {
          const { leftPeekIds, rightPeekIds } = hoverLayout;

          if (block.blockId === hoveredBlockId) {
            leftPercent = leftPeekIds.length * peekPercent;
            // S'étend sous les bandeaux droits pour éviter un trou de hit-test.
            widthPercent = 100 - leftPercent;
            isFrontmost = true;
            zIndex = 40;
          } else {
            const leftPeekIndex = leftPeekIds.indexOf(block.blockId);
            if (leftPeekIndex >= 0) {
              const stripsFromLeft = leftPeekIds.length - leftPeekIndex;
              leftPercent = leftPeekIndex * peekPercent;
              widthPercent = stripsFromLeft * peekPercent;
              isFrontmost = false;
              zIndex = 2 + leftPeekIndex;
              peekSide = "left";
            } else {
              const rightPeekIndex = rightPeekIds.indexOf(block.blockId);
              if (rightPeekIndex >= 0) {
                const stripsFromRight = rightPeekIds.length - rightPeekIndex;
                leftPercent = 100 - stripsFromRight * peekPercent;
                // Cascade vers la droite : les bandeaux plus à gauche restent
                // atteignables, sans trou entre le survolé et ses voisins.
                widthPercent = stripsFromRight * peekPercent;
                isFrontmost = false;
                zIndex = 50 + rightPeekIndex;
                peekSide = "right";
              }
              // Même colonne que le survolé : conserve le layout packing.
            }
          }
        }

        const displayTitle = formatEventBlockTitle(event);
        const startLabel = formatEventTime(event.startsAt);
        const endLabel = formatEventTime(event.endsAt);
        const isCompact = durationMinutes < 45;
        const showTimeRange = durationMinutes >= 45;
        const showMeta = singleDay && durationMinutes >= 75;
        const useFlushStack = isStacked;

        return (
          <button
            key={block.blockId}
            type="button"
            className={styles.eventBlock}
            data-planning-event-block="true"
            data-colored="true"
            data-compact={isCompact ? "true" : "false"}
            data-stacked={isStacked ? "true" : "false"}
            data-frontmost={isFrontmost ? "true" : "false"}
            data-peek-side={peekSide ?? undefined}
            style={{
              ...blockColorStyle(block),
              top: `${top}%`,
              height: `${Math.max(height, 2.2)}%`,
              left: useFlushStack
                ? `${leftPercent}%`
                : `calc(${leftPercent}% + 0.12rem)`,
              width: useFlushStack
                ? `${widthPercent}%`
                : `calc(${widthPercent}% - 0.24rem)`,
              zIndex,
            }}
            onClick={() => onSelectEvent(event)}
            onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
            onPointerEnter={() => {
              if (hoverClearFrameRef.current !== null) {
                cancelAnimationFrame(hoverClearFrameRef.current);
                hoverClearFrameRef.current = null;
              }
              if (isStacked) setHoveredBlockId(block.blockId);
            }}
            onPointerLeave={(pointerEvent) => {
              const nextTarget = pointerEvent.relatedTarget;
              if (
                nextTarget instanceof Element &&
                nextTarget.closest("[data-planning-event-block]")
              ) {
                return;
              }
              // Laisse le temps à un bandeau voisin de prendre le survol
              // (évite le reset vers le bloc front le plus à droite).
              const leavingId = block.blockId;
              if (hoverClearFrameRef.current !== null) {
                cancelAnimationFrame(hoverClearFrameRef.current);
              }
              hoverClearFrameRef.current = requestAnimationFrame(() => {
                hoverClearFrameRef.current = null;
                setHoveredBlockId((current) =>
                  current === leavingId ? null : current,
                );
              });
            }}
          >
            {isCompact ? (
              <span className={styles.eventBlockTitle}>
                {displayTitle}, {startLabel}
              </span>
            ) : (
              <>
                <span className={styles.eventBlockTitle}>{displayTitle}</span>
                {showTimeRange ? (
                  <span className={styles.eventBlockTime}>
                    {startLabel} – {endLabel}
                  </span>
                ) : null}
                {showMeta ? (
                  <span className={styles.eventBlockMeta}>
                    {event.location ? event.location : null}
                  </span>
                ) : null}
              </>
            )}
          </button>
        );
      })}
    </>
  );
}
