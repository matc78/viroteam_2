"use client";

import { FormEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createClubEvent,
  eventTypeLabel,
  formatDayHeading,
  type EventType,
  type PlanningPersonOption,
  type TeamOption,
} from "@/lib/firebase/eventService";
import {
  recurrenceEndForEventDay,
  resolveSeasonEndDate,
} from "@/lib/planning/seasonEnd";
import type { CreateEventDraft } from "./PlanningCalendar";
import {
  resolveGuestAudience,
  type PlanningGuestSelection,
} from "@/lib/planning/resolveGuestAudience";
import { PlanningGuestPicker } from "./PlanningGuestPicker";
import { PlanningSelect } from "./PlanningSelect";
import { PlanningTimeSelect } from "./PlanningTimeSelect";
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
  categories: string[];
  people: PlanningPersonOption[];
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
  categories,
  people,
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
  const [guests, setGuests] = useState<PlanningGuestSelection[]>([]);
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

  const teamSelectOptions = useMemo(
    () =>
      teams.map((team) => ({
        value: team.id,
        label: team.category
          ? `${team.name} (${team.category})`
          : team.name,
      })),
    [teams],
  );

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === teamId) ?? null,
    [teams, teamId],
  );

  const isMatch = type === "match";
  const isTraining = type === "training";
  const isTournament = type === "tournament";
  const isOther = type === "other";
  const needsSingleTeam = isTraining || isMatch;
  const guestAudience = useMemo(
    () => resolveGuestAudience(guests, teams, people),
    [guests, teams, people],
  );

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
    isTournament,
    isOther,
    isRecurring,
    needsSingleTeam,
    guests.length,
  ]);

  function handleTypeChange(nextType: EventType) {
    setType(nextType);
    setError(null);
    if (nextType !== "training") {
      setIsRecurring(false);
    }
    if (nextType === "other" || nextType === "tournament") {
      setTeamId("");
      setGuests([]);
      if (nextType === "other") {
        if (location === "Domicile" || location.trim() === "") {
          setLocation("Stade du club");
        }
        return;
      }
    }
    if (nextType === "training" || nextType === "match") {
      setGuests([]);
      if (!teamId && teams[0]) setTeamId(teams[0].id);
    }
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

    if (needsSingleTeam && !selectedTeam) {
      setError("Choisissez une équipe.");
      return;
    }
    if (isTournament && guests.length === 0) {
      setError("Ajoutez au moins une équipe ou une catégorie.");
      return;
    }
    if (isOther && !title.trim()) {
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

    let resolvedTeamIds: string[] = [];
    let resolvedMemberIds: string[] = [];
    let resolvedTitle = eventTypeLabel(type);

    if (needsSingleTeam && selectedTeam) {
      resolvedTeamIds = [selectedTeam.id];
      resolvedMemberIds = selectedTeam.playerIds;
      resolvedTitle = `${eventTypeLabel(type)} - ${selectedTeam.name}`;
    } else if (isTournament || isOther) {
      // « Autre » : invités optionnels (audience RSVP vide si aucun).
      resolvedTeamIds = guestAudience.teamIds;
      resolvedMemberIds = guestAudience.teamMemberIds;
      if (isOther) {
        resolvedTitle = title.trim();
      } else {
        const guestLabels = guests
          .slice(0, 3)
          .map((guest) => {
            if (guest.kind === "team") {
              return teams.find((team) => team.id === guest.id)?.name ?? guest.id;
            }
            return guest.id;
          });
        const suffix =
          guests.length > 3
            ? `${guestLabels.join(", ")}…`
            : guestLabels.join(", ");
        resolvedTitle = suffix
          ? `${eventTypeLabel(type)} - ${suffix}`
          : eventTypeLabel(type);
      }
    }

    setError(null);
    setSaving(true);
    try {
      await createClubEvent({
        clubId,
        creatorId,
        type,
        title: resolvedTitle,
        startDate: day,
        teamIds: resolvedTeamIds,
        teamMemberIds: resolvedMemberIds,
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

          {needsSingleTeam ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-event-team">
                Équipe
              </label>
              <PlanningSelect
                id="new-event-team"
                value={teamId}
                options={teamSelectOptions}
                onChange={setTeamId}
                required
                disabled={saving}
                placeholder="Choisir une équipe…"
              />
            </div>
          ) : null}

          {isTournament ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-event-guests">
                Équipes et catégories
              </label>
              <PlanningGuestPicker
                id="new-event-guests"
                teams={teams}
                categories={categories}
                allowedKinds={["team", "category"]}
                value={guests}
                onChange={setGuests}
                disabled={saving}
                placeholder="Ajouter une équipe ou catégorie…"
              />
            </div>
          ) : null}

          {isOther ? (
            <>
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
              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-event-guests">
                  Invités
                </label>
                <PlanningGuestPicker
                  id="new-event-guests"
                  teams={teams}
                  categories={categories}
                  people={people}
                  allowedKinds={["team", "category", "person"]}
                  value={guests}
                  onChange={setGuests}
                  disabled={saving}
                  placeholder="Ajouter équipes, catégories, personnes…"
                />
                {guests.length === 0 ? (
                  <p className={styles.hint}>
                    Optionnel — sans invités, personne n&apos;est convoqué au RSVP
                    (ex. AG informative).
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

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
                <PlanningTimeSelect
                  id="new-event-start"
                  value={startTime}
                  options={START_TIME_OPTIONS}
                  onChange={setStartTime}
                  required
                  disabled={saving}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-event-meeting">
                  Heure de RDV
                </label>
                <PlanningTimeSelect
                  id="new-event-meeting"
                  value={meetingTime}
                  options={START_TIME_OPTIONS}
                  onChange={setMeetingTime}
                  required
                  disabled={saving}
                />
              </div>
            </div>
          ) : (
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-event-start">
                  Début
                </label>
                <PlanningTimeSelect
                  id="new-event-start"
                  value={startTime}
                  options={START_TIME_OPTIONS}
                  onChange={setStartTime}
                  required
                  disabled={saving}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-event-end">
                  Fin
                </label>
                <PlanningTimeSelect
                  id="new-event-end"
                  value={endTime}
                  options={END_TIME_OPTIONS}
                  onChange={setEndTime}
                  required
                  disabled={saving}
                />
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
