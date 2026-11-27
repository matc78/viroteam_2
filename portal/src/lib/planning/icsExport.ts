import { eventTypeLabel, type ClubEventView } from "@/lib/firebase/eventService";

/** Événement exportable : vue planning + club (planning perso multi-clubs). */
export type IcsExportEvent = Pick<
  ClubEventView,
  | "id"
  | "title"
  | "type"
  | "startsAt"
  | "endsAt"
  | "location"
  | "teamLabels"
  | "startTimeSet"
  | "endTimeSet"
> & {
  clubId: string;
  clubName?: string;
};

/**
 * Contenu iCalendar (RFC 5545) des [events] à venir — même UID que l’app
 * (`{clubId}-{eventId}@viroteam.app`), donc un ré-import met à jour au lieu
 * de dupliquer. Horaires écrits en UTC (pas de fuseau à déclarer) ; titre
 * et horaires par défaut comme l’app (`CalendarSyncService`) : sans heure,
 * 18 h ; sans fin, 2 h.
 */
export function buildIcs(
  events: readonly IcsExportEvent[],
  options: { calendarName?: string; now?: Date } = {},
): string {
  const now = options.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ViroTeam//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.calendarName ?? "ViroTeam")}`,
  ];
  for (const event of upcomingEvents(events, now)) {
    const { start, end } = exportTimes(event);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.clubId}-${event.id}@viroteam.app`,
      `DTSTAMP:${formatUtc(now)}`,
      `DTSTART:${formatUtc(start)}`,
      `DTEND:${formatUtc(end)}`,
      `SUMMARY:${escapeText(calendarTitle(event))}`,
    );
    if (event.location.trim()) {
      lines.push(`LOCATION:${escapeText(event.location.trim())}`);
    }
    // Le planning perso met déjà le club en tête des libellés d’équipe.
    const teams = event.teamLabels.filter(
      (label) => label.trim() && label !== event.clubName,
    );
    const description = [event.clubName, teams.join(", ")]
      .filter((part) => part && part.trim())
      .join(" · ");
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Événements non terminés, triés par début ; dates invalides écartées. */
export function upcomingEvents<T extends IcsExportEvent>(
  events: readonly T[],
  now: Date,
): T[] {
  return events
    .filter((event) => {
      const start = Date.parse(event.startsAt);
      const end = Date.parse(event.endsAt);
      if (Number.isNaN(start)) return false;
      return (Number.isNaN(end) ? start : Math.max(start, end)) >= now.getTime();
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** Nom du fichier téléchargé (`viroteam_planning_2026-11-26.ics`). */
export function icsFileName(now: Date = new Date()): string {
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return `viroteam_planning_${day}.ics`;
}

/** Début / fin exportés : 18 h et 2 h par défaut, comme l’app. */
function exportTimes(event: IcsExportEvent): { start: Date; end: Date } {
  const twoHours = 2 * 60 * 60_000;
  const start = new Date(event.startsAt);
  if (event.startTimeSet === false) start.setHours(18, 0, 0, 0);
  let end =
    event.endTimeSet === false || event.startTimeSet === false
      ? new Date(start.getTime() + twoHours)
      : new Date(event.endsAt);
  if (!(end > start)) end = new Date(start.getTime() + twoHours);
  return { start, end };
}

/**
 * Titre d’agenda, comme l’app (`PlanningEventDisplay.calendarTitle`) :
 * réunion → « Réunion · détail », sinon titre saisi ou type.
 */
function calendarTitle(event: IcsExportEvent): string {
  const typeLabel = eventTypeLabel(event.type);
  const title = event.title.trim();
  if (event.type !== "meeting") return title || typeLabel;
  let detail: string | null = title && title !== typeLabel ? title : null;
  for (const separator of [" - ", " – ", " · "]) {
    const prefix = typeLabel + separator;
    if (detail?.startsWith(prefix)) {
      detail = detail.slice(prefix.length).trim() || null;
    }
  }
  return detail ? typeLabel + " · " + detail : typeLabel;
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Replie une ligne à 75 octets UTF-8 (suite préfixée d’un espace). */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + size > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Déclenche le téléchargement du fichier `.ics` dans le navigateur. */
export function downloadIcsFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Laisse au navigateur (Safari) le temps de lire le fichier.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
