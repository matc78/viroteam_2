import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import { Collections, Fields, MemberRoles } from "./constants";
import { getClub } from "./clubService";
import { toDate } from "./types";
import { resolveSeasonEndDate } from "@/lib/planning/seasonEnd";

/** Types d'événements club (aligné EventTypes Flutter). */
export type EventType = "training" | "match" | "tournament" | "other";

/** Fenêtre planning à venir — alignée EventService Flutter. */
export const UPCOMING_PLANNING_HORIZON_DAYS = 14;

/** Limite d'aperçu sur la home dashboard. */
export const HOME_PREVIEW_EVENT_LIMIT = 3;

/** Vue événement pour le portail admin. */
export type ClubEventView = {
  id: string;
  title: string;
  type: EventType;
  startsAt: string;
  /** Fin estimée (endTime Firestore, sinon début + 75 min). */
  endsAt: string;
  dateId: string;
  location: string;
  teamIds: string[];
  teamLabels: string[];
  /** Audience RSVP / joueurs convoqués. */
  teamMemberIds: string[];
  rsvpYes: number;
  rsvpNo: number;
  rsvpPending: number;
  rsvpTotal: number;
};

/** Alias conservé pour la home dashboard. */
export type UpcomingEvent = ClubEventView;

export type TeamOption = {
  id: string;
  name: string;
  category: string;
  /** Identifiants roster joueurs (pour `teamMemberIds` à la création). */
  playerIds: string[];
  coachIds: string[];
};

/** Membre club pour filtres planning et invités (coach / joueur / admin). */
export type PlanningPersonOption = {
  id: string;
  /** Identifiants possibles (memberId, accountUid) pour matcher les rosters. */
  matchIds: string[];
  name: string;
  role: "coach" | "player" | "admin" | "other";
};

export type PlanningPageData = {
  events: ClubEventView[];
  teams: TeamOption[];
  coaches: PlanningPersonOption[];
  players: PlanningPersonOption[];
  /** Admins du club (invités « Autre », hors filtres sidebar). */
  admins: PlanningPersonOption[];
  categories: string[];
  /** Fin de saison résolue (club ou défaut 30 juin). */
  seasonEndDate: Date;
};

/** Payload de création d'événement (aligné EventService Flutter). */
export type CreateClubEventInput = {
  clubId: string;
  creatorId: string;
  type: EventType;
  title: string;
  startDate: Date;
  teamIds: string[];
  teamMemberIds: string[];
  location: string;
  startTime: string;
  endTime?: string;
  meetingTime?: string;
  matchVenue?: "home" | "away";
  allTeams?: boolean;
  /** Fin de récurrence hebdomadaire (aligné Flutter, max 52 occurrences). */
  recurrenceEndDate?: Date | null;
};

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  training: "Entraînement",
  match: "Match",
  tournament: "Tournoi",
  other: "Autre",
};

/** Libellé français du type d'événement. */
export function eventTypeLabel(type: EventType): string {
  return EVENT_TYPE_LABELS[type];
}

/** Formate une date en identifiant Firestore `dateId` (YYYYMMDD). */
export function formatDateId(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** Date locale sans heure. */
export function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Fusionne une date calendaire avec une heure `HH:mm`. */
export function combineDateAndTime(date: Date, time?: string | null): Date {
  const result = dateOnly(date);
  if (!time) return result;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return result;
  result.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return result;
}

/** Vérifie si une date est dans la fenêtre planning à venir. */
export function isWithinUpcomingPlanningWindow(
  eventDate: Date,
  clock = new Date(),
): boolean {
  const today = dateOnly(clock);
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + UPCOMING_PLANNING_HORIZON_DAYS);
  const day = dateOnly(eventDate);
  return day.getTime() >= today.getTime() && day.getTime() <= horizonEnd.getTime();
}

function parseEventType(raw: unknown): EventType {
  const value = String(raw ?? "other");
  if (
    value === "training" ||
    value === "match" ||
    value === "tournament" ||
    value === "other"
  ) {
    return value;
  }
  return "other";
}

function parseRsvpCounts(data: Record<string, unknown>): {
  rsvpYes: number;
  rsvpNo: number;
  rsvpPending: number;
  rsvpTotal: number;
} {
  const rsvpRaw = data[Fields.rsvp];
  const rsvp =
    rsvpRaw && typeof rsvpRaw === "object"
      ? (rsvpRaw as Record<string, string>)
      : {};
  const values = Object.values(rsvp);
  const rsvpYes = values.filter((value) => value === "yes").length;
  const rsvpNo = values.filter((value) => value === "no").length;
  const teamMemberIds = Array.isArray(data[Fields.teamMemberIds])
    ? (data[Fields.teamMemberIds] as unknown[]).map(String)
    : [];
  const rsvpTotal =
    teamMemberIds.length > 0 ? teamMemberIds.length : values.length;
  const rsvpPending = Math.max(0, rsvpTotal - rsvpYes - rsvpNo);

  return { rsvpYes, rsvpNo, rsvpPending, rsvpTotal };
}

/** Parse un document Firestore events en vue portail. */
export function parseClubEvent(
  id: string,
  data: Record<string, unknown>,
  teamNameById: Map<string, string> = new Map(),
): ClubEventView | null {
  if (data[Fields.canceled] === true) return null;
  const eventDate = toDate(data[Fields.date]) ?? toDate(data[Fields.startTime]);
  if (!eventDate) return null;

  const teamIds = Array.isArray(data[Fields.teamIds])
    ? (data[Fields.teamIds] as unknown[]).map(String)
    : [];
  const teamLabels =
    teamIds.length > 0
      ? teamIds.map((teamId) => teamNameById.get(teamId) ?? "Équipe")
      : ["Club"];

  const { rsvpYes, rsvpNo, rsvpPending, rsvpTotal } = parseRsvpCounts(data);
  const dateId =
    typeof data[Fields.dateId] === "string" && data[Fields.dateId]
      ? String(data[Fields.dateId])
      : formatDateId(eventDate);
  const startTimeRaw = data[Fields.startTime];
  const startTime =
    typeof startTimeRaw === "string" && startTimeRaw.trim()
      ? startTimeRaw.trim()
      : null;
  const endTimeRaw = data[Fields.endTime];
  const endTime =
    typeof endTimeRaw === "string" && endTimeRaw.trim()
      ? endTimeRaw.trim()
      : null;
  const startsAtDate = combineDateAndTime(eventDate, startTime);
  const endsAtDate = endTime
    ? combineDateAndTime(eventDate, endTime)
    : new Date(startsAtDate.getTime() + 75 * 60_000);
  if (endsAtDate.getTime() <= startsAtDate.getTime()) {
    endsAtDate.setTime(startsAtDate.getTime() + 75 * 60_000);
  }

  return {
    id,
    title: String(data[Fields.title] ?? "Événement"),
    type: parseEventType(data[Fields.type]),
    startsAt: startsAtDate.toISOString(),
    endsAt: endsAtDate.toISOString(),
    dateId,
    location: String(data[Fields.location] ?? ""),
    teamIds,
    teamLabels,
    teamMemberIds: Array.isArray(data[Fields.teamMemberIds])
      ? (data[Fields.teamMemberIds] as unknown[]).map(String)
      : [],
    rsvpYes,
    rsvpNo,
    rsvpPending,
    rsvpTotal,
  };
}

/** Charge les équipes d'un club pour résoudre les libellés. */
export async function loadTeamsForClub(clubId: string): Promise<TeamOption[]> {
  const teamsCol = collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.teams,
  );
  const snap = await getDocs(query(teamsCol, limit(80)));
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const playerIdsRaw = data[Fields.playerIds];
      const coachIdsRaw = data[Fields.coachIds];
      const playerIds = Array.isArray(playerIdsRaw)
        ? playerIdsRaw.map(String)
        : [];
      const coachIds = Array.isArray(coachIdsRaw)
        ? coachIdsRaw.map(String)
        : [];
      const category =
        typeof data[Fields.category] === "string"
          ? String(data[Fields.category]).trim()
          : "";
      return {
        id: docSnap.id,
        name: String(data[Fields.name] ?? "Équipe"),
        category,
        playerIds,
        coachIds,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Charge les membres du club pour les filtres coach / joueur. */
export async function loadPlanningPeopleForClub(
  clubId: string,
): Promise<PlanningPersonOption[]> {
  const membersCol = collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.members,
  );
  const snap = await getDocs(query(membersCol, limit(300)));
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const firstName = String(data[Fields.firstName] ?? "").trim();
      const lastName = String(data[Fields.lastName] ?? "").trim();
      const displayName = String(data[Fields.displayName] ?? "").trim();
      const name =
        [firstName, lastName].filter(Boolean).join(" ") ||
        displayName ||
        "Membre";
      const accountUid = String(data[Fields.accountUid] ?? "").trim();
      const matchIds = Array.from(
        new Set([docSnap.id, accountUid].filter(Boolean)),
      );
      const roleRaw = String(data[Fields.role] ?? "");
      const role =
        roleRaw === MemberRoles.coach ||
        roleRaw === MemberRoles.player ||
        roleRaw === MemberRoles.admin
          ? roleRaw
          : "other";
      return {
        id: docSnap.id,
        matchIds,
        name,
        role,
      } satisfies PlanningPersonOption;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Construit les dates de récurrence hebdomadaire (max 52). */
function buildRecurrenceDates(
  startDate: Date,
  recurrenceEndDate?: Date | null,
): Date[] {
  const start = dateOnly(startDate);
  if (!recurrenceEndDate) return [start];
  const end = dateOnly(recurrenceEndDate);
  if (end.getTime() < start.getTime()) return [start];

  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime() && dates.length < 52) {
    dates.push(dateOnly(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates.length > 0 ? dates : [start];
}

/**
 * Crée un ou plusieurs événements club (récurrence hebdo optionnelle).
 * Retourne le nombre d'événements créés.
 */
export async function createClubEvent(
  input: CreateClubEventInput,
): Promise<number> {
  const dates = buildRecurrenceDates(
    input.startDate,
    input.recurrenceEndDate,
  );
  const eventsCol = eventsCollection(input.clubId);
  const batch = writeBatch(getAppFirestore());
  const seriesId = dates.length > 1 ? doc(eventsCol).id : null;

  for (const day of dates) {
    const eventRef = doc(eventsCol);
    const payload: Record<string, unknown> = {
      [Fields.type]: input.type,
      [Fields.title]: input.title,
      [Fields.location]: input.location,
      [Fields.teamIds]: input.teamIds,
      [Fields.allTeams]: input.allTeams ?? false,
      [Fields.date]: Timestamp.fromDate(
        new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())),
      ),
      [Fields.dateId]: formatDateId(day),
      [Fields.startTime]: input.startTime,
      [Fields.teamMemberIds]: input.teamMemberIds,
      [Fields.rsvp]: {},
      [Fields.attendance]: {},
      [Fields.creatorId]: input.creatorId,
      [Fields.canceled]: false,
      [Fields.createdAt]: serverTimestamp(),
    };
    if (input.endTime) payload[Fields.endTime] = input.endTime;
    if (input.meetingTime) payload[Fields.meetingTime] = input.meetingTime;
    if (input.matchVenue) payload[Fields.matchVenue] = input.matchVenue;
    if (seriesId) payload[Fields.seriesId] = seriesId;
    batch.set(eventRef, payload);
  }

  await batch.commit();
  return dates.length;
}

function eventsCollection(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.events,
  );
}

async function queryEventsByDateIdRange(
  clubId: string,
  startDateId: string,
  endDateId: string,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const eventsCol = eventsCollection(clubId);

  try {
    const rangeQuery = query(
      eventsCol,
      where(Fields.dateId, ">=", startDateId),
      where(Fields.dateId, "<=", endDateId),
      orderBy(Fields.dateId, "asc"),
      limit(200),
    );
    const snap = await getDocs(rangeQuery);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() as Record<string, unknown>,
    }));
  } catch {
    try {
      const fallbackQuery = query(
        eventsCol,
        where(Fields.dateId, ">=", startDateId),
        orderBy(Fields.dateId, "asc"),
        limit(200),
      );
      const snap = await getDocs(fallbackQuery);
      return snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          data: docSnap.data() as Record<string, unknown>,
        }))
        .filter(({ data }) => {
          const dateId = String(data[Fields.dateId] ?? "");
          return dateId <= endDateId;
        });
    } catch {
      const snap = await getDocs(query(eventsCol, limit(120)));
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data() as Record<string, unknown>,
      }));
    }
  }
}

async function queryUpcomingRawEvents(clubId: string): Promise<
  Array<{ id: string; data: Record<string, unknown> }>
> {
  const today = dateOnly(new Date());
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + UPCOMING_PLANNING_HORIZON_DAYS);
  return queryEventsByDateIdRange(
    clubId,
    formatDateId(today),
    formatDateId(horizonEnd),
  );
}

/** Charge les événements à venir d'un club dans la fenêtre 14 jours. */
export async function loadUpcomingEvents(
  clubId: string,
  options: { limit?: number } = {},
): Promise<ClubEventView[]> {
  const teams = await loadTeamsForClub(clubId);
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const rawEvents = await queryUpcomingRawEvents(clubId);

  const parsed = rawEvents
    .map(({ id, data }) => parseClubEvent(id, data, teamNameById))
    .filter((event): event is ClubEventView => event !== null)
    .filter((event) => isWithinUpcomingPlanningWindow(new Date(event.startsAt)))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  const maxItems = options.limit ?? parsed.length;
  return parsed.slice(0, maxItems);
}

/** Charge les événements d'un club dans une plage de dates inclusive. */
export async function loadEventsInRange(
  clubId: string,
  start: Date,
  end: Date,
): Promise<ClubEventView[]> {
  const teams = await loadTeamsForClub(clubId);
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const rawEvents = await queryEventsByDateIdRange(
    clubId,
    formatDateId(dateOnly(start)),
    formatDateId(dateOnly(end)),
  );

  const startMs = dateOnly(start).getTime();
  const endMs = dateOnly(end).getTime();

  return rawEvents
    .map(({ id, data }) => parseClubEvent(id, data, teamNameById))
    .filter((event): event is ClubEventView => event !== null)
    .filter((event) => {
      const dayMs = dateOnly(new Date(event.startsAt)).getTime();
      return dayMs >= startMs && dayMs <= endMs;
    })
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
}

/** Charge les données complètes de la page planning (plage calendrier élargie). */
export async function loadPlanningPageData(
  clubId: string,
  options: { start?: Date; end?: Date } = {},
): Promise<PlanningPageData> {
  const [teams, people, club] = await Promise.all([
    loadTeamsForClub(clubId),
    loadPlanningPeopleForClub(clubId),
    getClub(clubId),
  ]);
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const seasonEndDate = resolveSeasonEndDate(club?.seasonEndDate ?? null);

  const start =
    options.start ??
    (() => {
      const today = dateOnly(new Date());
      return new Date(today.getFullYear(), today.getMonth() - 1, 1);
    })();
  const end =
    options.end ??
    (() => {
      const today = dateOnly(new Date());
      return new Date(today.getFullYear(), today.getMonth() + 2, 0);
    })();

  const rawEvents = await queryEventsByDateIdRange(
    clubId,
    formatDateId(dateOnly(start)),
    formatDateId(dateOnly(end)),
  );

  const startMs = dateOnly(start).getTime();
  const endMs = dateOnly(end).getTime();

  const events = rawEvents
    .map(({ id, data }) => parseClubEvent(id, data, teamNameById))
    .filter((event): event is ClubEventView => event !== null)
    .filter((event) => {
      const dayMs = dateOnly(new Date(event.startsAt)).getTime();
      return dayMs >= startMs && dayMs <= endMs;
    })
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  const coaches = people.filter((person) => person.role === "coach");
  const players = people.filter((person) => person.role === "player");
  const admins = people.filter((person) => person.role === "admin");
  const categories = Array.from(
    new Set(
      teams
        .map((team) => team.category)
        .filter((category) => category.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "fr"));

  return {
    events,
    teams,
    coaches,
    players,
    admins,
    categories,
    seasonEndDate,
  };
}

/** Début de semaine (lundi). */
export function startOfWeek(date: Date): Date {
  const day = dateOnly(date);
  const weekday = day.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + offset);
  return day;
}

/** Fin de semaine (dimanche). */
export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

/** Grille mois (6 semaines × 7 jours, lundi → dimanche). */
export function buildMonthGrid(monthCursor: Date): Date[] {
  const firstOfMonth = new Date(
    monthCursor.getFullYear(),
    monthCursor.getMonth(),
    1,
  );
  const gridStart = startOfWeek(firstOfMonth);
  const days: Date[] = [];
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    days.push(day);
  }
  return days;
}

/** Jours d'une semaine à partir d'une date. */
export function buildWeekDays(weekCursor: Date): Date[] {
  const start = startOfWeek(weekCursor);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

/** Libellé période calendrier selon la vue. */
export function formatCalendarPeriodLabel(
  cursor: Date,
  view: "month" | "week" | "day",
): string {
  if (view === "month") {
    return new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(cursor);
  }
  if (view === "day") {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(cursor);
  }
  const start = startOfWeek(cursor);
  const end = endOfWeek(cursor);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(end)}`;
  }
  const startLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}

/** Construit la liste des jours couvrant la fenêtre planning. */
export function buildPlanningDays(clock = new Date()): Date[] {
  const days: Date[] = [];
  const start = dateOnly(clock);
  for (let offset = 0; offset < UPCOMING_PLANNING_HORIZON_DAYS; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    days.push(day);
  }
  return days;
}

/** Formate l'heure d'un event (fr-FR). */
export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Formate date + heure courte pour listes. */
export function formatEventWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Formate un en-tête de jour. */
export function formatDayHeading(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
