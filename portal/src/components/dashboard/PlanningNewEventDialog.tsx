"use client";

import { FormEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createClubEvent,
  eventTypeLabel,
  formatDayHeading,
  type EventType,
  type TeamOption,
} from "@/lib/firebase/eventService";
import {
  recurrenceEndForEventDay,
  resolveSeasonEndDate,
} from "@/lib/planning/seasonEnd";
import type { CreateEventDraft } from "./PlanningCalendar";
import panelStyles from "./DashboardPanel.module.css";
import styles from "./PlanningNewEventDialog.module.css";

/** Props du dialog de création d'événement. */
type PlanningNewEventDialogProps = {
  day: Date;
  /** Heure de début préremplie (`HH:mm`, pas de 15 min). */
  initialStartTime?: string;
  /** Heure de fin préremplie (`HH:mm`, pas de 15 min). */
  initialEndTime?: string;
  /** Ancrage viewport pour placer le dialog à côté de la sélection. */
  anchor?: CreateEventDraft["anchor"] | null;
  clubId: string;
  creatorId: string;
  teams: TeamOption[];
  /** Fin de saison du club (sinon défaut 30 juin). */
  seasonEndDate?: Date | null;
  onClose: () => void;
  onCreated: () => void;
};

const EVENT_TYPES: EventType[] = ["training", "match", "tournament", "other"];
const TIME_HOUR_START = 0;
const TIME_HOUR_END = 24;
const DIALOG_GAP_PX = 14;
const DIALOG_MARGIN_PX = 16;
const DIALOG_FALLBACK_WIDTH_PX = 416;

const TYPE_TONE: Record<EventType, string> = {
  training: "blue",
  match: "green",
  tournament: "amber",
  other: "neutral",
};

/** Construit la liste des créneaux de 15 minutes. */
function buildQuarterHourOptions(includeEndHour = false): string[] {
  const options: string[] = [];
  for (let hour = TIME_HOUR_START; hour <= TIME_HOUR_END; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      if (hour === TIME_HOUR_END && minute > 0) break;
      if (!includeEndHour && hour === TIME_HOUR_END) break;
      options.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      );
    }
  }
  if (includeEndHour) {
    options.push(`${String(TIME_HOUR_END).padStart(2, "0")}:00`);
  }
  return Array.from(new Set(options));
}

const START_TIME_OPTIONS = buildQuarterHourOptions(false);
const END_TIME_OPTIONS = buildQuarterHourOptions(true);

function snapToQuarterHour(value: string, options: string[]): string {
  if (options.includes(value)) return value;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return options[0] ?? "18:00";
  const total = Number(match[1]) * 60 + Number(match[2]);
  const snapped = Math.round(total / 15) * 15;
  const hours = Math.floor(snapped / 60);
  const minutes = snapped % 60;
  const label = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return options.includes(label) ? label : (options[0] ?? "18:00");
}

function shiftTimeLabel(value: string, deltaMinutes: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const total = Number(match[1]) * 60 + Number(match[2]) + deltaMinutes;
  const clamped = Math.min(
    TIME_HOUR_END * 60,
    Math.max(TIME_HOUR_START * 60, total),
  );
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Formate une date pour un input `type="date"`. */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

/** Parse une valeur `YYYY-MM-DD` en date locale. */
function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const dayOfMonth = Number(match[3]);
  const parsed = new Date(year, month, dayOfMonth);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== dayOfMonth
  ) {
    return null;
  }
  return parsed;
}

/**
 * Place le dialog au milieu vertical de l'écran, à gauche ou à droite
 * de l'ancre selon l'espace disponible.
 */
function computeAnchoredPosition(
  anchor: CreateEventDraft["anchor"],
  panelWidth: number,
  panelHeight: number,
): { left: number; top: number; side: "left" | "right" } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spaceRight = viewportWidth - anchor.right - DIALOG_MARGIN_PX;
  const spaceLeft = anchor.left - DIALOG_MARGIN_PX;
  const preferRight =
    spaceRight >= panelWidth + DIALOG_GAP_PX || spaceRight >= spaceLeft;

  let left = preferRight
    ? anchor.right + DIALOG_GAP_PX
    : anchor.left - DIALOG_GAP_PX - panelWidth;
  left = Math.max(
    DIALOG_MARGIN_PX,
    Math.min(left, viewportWidth - panelWidth - DIALOG_MARGIN_PX),
  );

  let top = (viewportHeight - panelHeight) / 2;
  top = Math.max(
    DIALOG_MARGIN_PX,
    Math.min(top, viewportHeight - panelHeight - DIALOG_MARGIN_PX),
  );

  return { left, top, side: preferRight ? "right" : "left" };
}

/** Dialog pour créer un événement (jour + plage horaire optionnelle). */
export function PlanningNewEventDialog({
  day,
  initialStartTime = "18:00",
  initialEndTime = "19:30",
  anchor = null,
  clubId,
  creatorId,
  teams,
  seasonEndDate = null,
  onClose,
  onCreated,
}: PlanningNewEventDialogProps) {
  const resolvedSeasonEnd = useMemo(
    () =>
      recurrenceEndForEventDay(day, resolveSeasonEndDate(seasonEndDate, day)),
    [day, seasonEndDate],
  );
  const panelRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    side: "left" | "right";
  } | null>(() => {
    if (typeof window === "undefined" || !anchor) return null;
    return computeAnchoredPosition(anchor, DIALOG_FALLBACK_WIDTH_PX, 480);
  });
  const [type, setType] = useState<EventType>("training");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(() =>
    snapToQuarterHour(initialStartTime, START_TIME_OPTIONS),
  );
  const [endTime, setEndTime] = useState(() =>
    snapToQuarterHour(initialEndTime, END_TIME_OPTIONS),
  );
  const [meetingTime, setMeetingTime] = useState(() =>
    snapToQuarterHour(
      shiftTimeLabel(initialStartTime, -30),
      START_TIME_OPTIONS,
    ),
  );
  const [matchVenue, setMatchVenue] = useState<"home" | "away">("home");
  const [location, setLocation] = useState("Stade du club");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(() =>
    toDateInputValue(
      recurrenceEndForEventDay(day, resolveSeasonEndDate(seasonEndDate, day)),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === teamId) ?? null,
    [teams, teamId],
  );

  const needsTeam = type !== "other";
  const needsCustomTitle = type === "other";
  const isMatch = type === "match";
  const isTraining = type === "training";

  useLayoutEffect(() => {
    function updatePosition() {
      if (!anchor) {
        setPosition(null);
        return;
      }
      const panel = panelRef.current;
      const width = panel?.offsetWidth || DIALOG_FALLBACK_WIDTH_PX;
      const height = panel?.offsetHeight || 480;
      setPosition(computeAnchoredPosition(anchor, width, height));
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [
    anchor,
    type,
    matchVenue,
    error,
    isMatch,
    isTraining,
    isRecurring,
    needsTeam,
    needsCustomTitle,
  ]);

  function handleTypeChange(nextType: EventType) {
    setType(nextType);
    setError(null);
    if (nextType !== "training") {
      setIsRecurring(false);
    }
    if (nextType === "other") {
      setTeamId("");
      return;
    }
    if (!teamId && teams[0]) setTeamId(teams[0].id);
    if (nextType === "match") {
      setMatchVenue("home");
      setLocation("Domicile");
      return;
    }
    if (location === "Domicile" || location.trim() === "") {
      setLocation("Stade du club");
    }
  }

  function handleRecurringChange(checked: boolean) {
    setIsRecurring(checked);
    setError(null);
    if (checked) {
      setRecurrenceEndDate(toDateInputValue(resolvedSeasonEnd));
    }
  }

  function handleMatchVenueChange(venue: "home" | "away") {
    setMatchVenue(venue);
    if (venue === "home") {
      setLocation("Domicile");
      return;
    }
    if (location === "Domicile") setLocation("");
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (saving) return;

    if (needsTeam && !selectedTeam) {
      setError("Choisissez une équipe.");
      return;
    }
    if (needsCustomTitle && !title.trim()) {
      setError("Titre requis.");
      return;
    }
    if (isMatch && matchVenue === "away" && !location.trim()) {
      setError("Lieu du match requis.");
      return;
    }
    if (!isMatch && !location.trim()) {
      setError("Lieu requis.");
      return;
    }
    if (!isMatch) {
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const [endHour, endMinute] = endTime.split(":").map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      if (endMinutes <= startMinutes) {
        setError("L'heure de fin doit être après le début.");
        return;
      }
    }

    let resolvedRecurrenceEnd: Date | null = null;
    if (isTraining && isRecurring) {
      resolvedRecurrenceEnd = parseDateInputValue(recurrenceEndDate);
      if (!resolvedRecurrenceEnd) {
        setError("Date de fin de récurrence invalide.");
        return;
      }
      const eventDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      if (resolvedRecurrenceEnd.getTime() < eventDay.getTime()) {
        setError("La date de fin doit être après le début de la série.");
        return;
      }
    }

    const resolvedLocation = isMatch
      ? matchVenue === "home"
        ? "Domicile"
        : location.trim()
      : location.trim();

    setError(null);
    setSaving(true);
    try {
      await createClubEvent({
        clubId,
        creatorId,
        type,
        title: needsCustomTitle
          ? title.trim()
          : selectedTeam
            ? `${eventTypeLabel(type)} - ${selectedTeam.name}`
            : eventTypeLabel(type),
        startDate: day,
        teamIds: selectedTeam ? [selectedTeam.id] : [],
        teamMemberIds: selectedTeam ? selectedTeam.playerIds : [],
        location: resolvedLocation,
        startTime,
        endTime: isMatch ? undefined : endTime,
        meetingTime: isMatch ? meetingTime : undefined,
        matchVenue: isMatch ? matchVenue : undefined,
        recurrenceEndDate: resolvedRecurrenceEnd,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer l'événement.",
      );
    } finally {
      setSaving(false);
    }
  }

  const anchored = Boolean(anchor && position);

  return (
    <div
      className={styles.backdrop}
      data-anchored={anchored ? "true" : "false"}
      role="presentation"
      onClick={onClose}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") onClose();
      }}
    >
      <aside
        ref={panelRef}
        className={`${panelStyles.panel} ${styles.panel}`}
        data-tone="cyan"
        data-side={position?.side ?? "center"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-event-title"
        style={
          anchored && position
            ? { left: position.left, top: position.top }
            : undefined
        }
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.eyebrow}>Nouvel événement</p>
            <h2 id="new-event-title" className={styles.title}>
              Créer un événement
            </h2>
            <span className={styles.dateChip}>{formatDayHeading(day)}</span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.section}>
            <span className={styles.label}>Type</span>
            <div
              className={styles.typeGrid}
              role="group"
              aria-label="Type d'événement"
            >
              {EVENT_TYPES.map((eventType) => (
                <button
                  key={eventType}
                  type="button"
                  className={styles.typeChip}
                  data-tone={TYPE_TONE[eventType]}
                  data-active={type === eventType ? "true" : "false"}
                  aria-pressed={type === eventType}
                  onClick={() => handleTypeChange(eventType)}
                  disabled={saving}
                >
                  {eventTypeLabel(eventType)}
                </button>
              ))}
            </div>
          </div>

          {needsTeam ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-event-team">
                Équipe
              </label>
              <select
                id="new-event-team"
                className={styles.input}
                value={teamId}
                onChange={(changeEvent) => setTeamId(changeEvent.target.value)}
                required
                disabled={saving}
              >
                {teams.length === 0 ? (
                  <option value="">Aucune équipe</option>
                ) : null}
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-event-title-input">
                Titre
              </label>
              <input
                id="new-event-title-input"
                className={styles.input}
                value={title}
                onChange={(changeEvent) => setTitle(changeEvent.target.value)}
                placeholder="Réunion, AG…"
                required
                disabled={saving}
              />
            </div>
          )}

          {isMatch ? (
            <div className={styles.section}>
              <span className={styles.label}>Domicile ou extérieur</span>
              <div
                className={styles.venueRow}
                role="group"
                aria-label="Lieu du match"
              >
                <button
                  type="button"
                  className={styles.venueChip}
                  data-active={matchVenue === "home" ? "true" : "false"}
                  aria-pressed={matchVenue === "home"}
                  onClick={() => handleMatchVenueChange("home")}
                  disabled={saving}
                >
                  Domicile
                </button>
                <button
                  type="button"
                  className={styles.venueChip}
                  data-active={matchVenue === "away" ? "true" : "false"}
                  aria-pressed={matchVenue === "away"}
                  onClick={() => handleMatchVenueChange("away")}
                  disabled={saving}
                >
                  Extérieur
                </button>
              </div>
            </div>
          ) : null}

          {isMatch ? (
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-event-start">
                  Heure du match
                </label>
                <select
                  id="new-event-start"
                  className={styles.input}
                  value={startTime}
                  onChange={(changeEvent) =>
                    setStartTime(changeEvent.target.value)
                  }
                  required
                  disabled={saving}
                >
                  {START_TIME_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-event-meeting">
                  Heure de RDV
                </label>
                <select
                  id="new-event-meeting"
                  className={styles.input}
                  value={meetingTime}
                  onChange={(changeEvent) =>
                    setMeetingTime(changeEvent.target.value)
                  }
                  required
                  disabled={saving}
                >
                  {START_TIME_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-event-start">
                  Début
                </label>
                <select
                  id="new-event-start"
                  className={styles.input}
                  value={startTime}
                  onChange={(changeEvent) =>
                    setStartTime(changeEvent.target.value)
                  }
                  required
                  disabled={saving}
                >
                  {START_TIME_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-event-end">
                  Fin
                </label>
                <select
                  id="new-event-end"
                  className={styles.input}
                  value={endTime}
                  onChange={(changeEvent) =>
                    setEndTime(changeEvent.target.value)
                  }
                  required
                  disabled={saving}
                >
                  {END_TIME_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!isMatch || matchVenue === "away" ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-event-location">
                {isMatch ? "Lieu du match" : "Lieu"}
              </label>
              <input
                id="new-event-location"
                className={styles.input}
                value={location}
                onChange={(changeEvent) => setLocation(changeEvent.target.value)}
                placeholder={isMatch ? "Ville, stade adverse…" : "Stade du club"}
                required
                disabled={saving}
              />
            </div>
          ) : null}

          {isTraining ? (
            <div className={styles.recurrenceBlock}>
              <label className={styles.recurrenceToggle}>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(changeEvent) =>
                    handleRecurringChange(changeEvent.target.checked)
                  }
                  disabled={saving}
                />
                <span>Récurrence hebdomadaire</span>
              </label>
              {isRecurring ? (
                <div className={styles.field}>
                  <label
                    className={styles.label}
                    htmlFor="new-event-recurrence-end"
                  >
                    Fin de saison
                  </label>
                  <input
                    id="new-event-recurrence-end"
                    type="date"
                    className={styles.input}
                    value={recurrenceEndDate}
                    min={toDateInputValue(day)}
                    onChange={(changeEvent) =>
                      setRecurrenceEndDate(changeEvent.target.value)
                    }
                    required
                    disabled={saving}
                  />
                  <p className={styles.hint}>
                    Par défaut : fin de saison du club (modifiable dans
                    Cotisations).
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={saving}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={saving}
            >
              {saving
                ? "Création…"
                : isTraining && isRecurring
                  ? "Créer la série"
                  : "Créer"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
