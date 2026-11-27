import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import {
  attendancePeriodStart,
  summarizeAttendance,
  type AttendanceTeam,
} from "@/lib/attendance/attendanceStats";
import { getAppFirestore } from "@/lib/firebase/app";
import { Collections, Fields } from "@/lib/firebase/constants";
import {
  dateOnly,
  formatDateId,
  loadPlanningPeopleForClub,
  loadTeamsForClub,
  parseClubEvent,
  type ClubEventView,
  type TeamOption,
} from "@/lib/firebase/eventService";

/** Taille d’une page de lecture des événements. */
const PAGE_SIZE = 300;

/** Plafond de pages (≈ 1 800 événements : une saison d’un gros club). */
const MAX_PAGES = 6;

/** Données de la page Présences. */
export type AttendanceData = {
  /** Événements non annulés de la période (passés et à venir). */
  events: ClubEventView[];
  teams: TeamOption[];
  /** Id de fiche → nom affiché. */
  names: Map<string, string>;
  /** True si le plafond de lecture a coupé la période. */
  truncated: boolean;
};

/**
 * Charge les événements du club entre [start] et aujourd’hui (pagination
 * sur `dateId`), ses équipes et les noms des membres.
 */
export async function loadAttendanceData(params: {
  clubId: string;
  start: Date;
  end: Date;
}): Promise<AttendanceData> {
  const [teams, people] = await Promise.all([
    loadTeamsForClub(params.clubId),
    loadPlanningPeopleForClub(params.clubId),
  ]);
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const { events, truncated } = await loadEventsInRange({
    ...params,
    teamNameById,
  });
  return {
    events,
    teams,
    names: new Map(people.map((person) => [person.id, person.name])),
    truncated,
  };
}

/**
 * Taux de présence des 30 derniers jours des équipes [teams] : même calcul
 * que la page Présences (période « 30 jours », joueurs des effectifs
 * seulement) ; `null` sans convocation.
 */
export async function loadRecentPresenceRate(params: {
  clubId: string;
  teams: readonly AttendanceTeam[] | Promise<readonly AttendanceTeam[]>;
}): Promise<number | null> {
  const now = new Date();
  // Lecture des événements lancée tout de suite, en parallèle des équipes.
  const [teams, { events }] = await Promise.all([
    params.teams,
    loadEventsInRange({
      clubId: params.clubId,
      start: attendancePeriodStart("30d", now),
      end: now,
    }),
  ]);
  if (teams.length === 0) return null;
  return summarizeAttendance({ teams, events, now }).rate;
}

/** Événements non annulés du club sur [start, end] (pagination `dateId`). */
export async function loadEventsInRange(params: {
  clubId: string;
  start: Date;
  end: Date;
  teamNameById?: Map<string, string>;
}): Promise<{ events: ClubEventView[]; truncated: boolean }> {
  const eventsCol = collection(
    getAppFirestore(),
    Collections.clubs,
    params.clubId,
    Collections.events,
  );
  const teamNameById = params.teamNameById ?? new Map<string, string>();
  const startId = formatDateId(dateOnly(params.start));
  const endId = formatDateId(dateOnly(params.end));
  const events: ClubEventView[] = [];
  let cursor: QueryDocumentSnapshot | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const constraints: QueryConstraint[] = [
      where(Fields.dateId, ">=", startId),
      where(Fields.dateId, "<=", endId),
      orderBy(Fields.dateId, "asc"),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(PAGE_SIZE),
    ];
    const snap: QuerySnapshot = await getDocs(query(eventsCol, ...constraints));
    for (const docSnap of snap.docs) {
      const event = parseClubEvent(
        docSnap.id,
        docSnap.data() as Record<string, unknown>,
        teamNameById,
      );
      if (event) events.push(event);
    }
    if (snap.docs.length < PAGE_SIZE) break;
    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { events, truncated };
}
