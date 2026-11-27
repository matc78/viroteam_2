import type { ClubEventView, EventType } from "@/lib/firebase/eventService";

/**
 * Statistiques de présence basées sur les réponses RSVP des convoqués
 * (`teamMemberIds`, déjà nets des joueurs retirés). Pas de pointage terrain :
 * « présent » = a répondu « oui ».
 */

/** Événement utile au calcul (vue planning). */
export type AttendanceEvent = Pick<
  ClubEventView,
  | "id"
  | "title"
  | "type"
  | "startsAt"
  | "teamIds"
  | "teamMemberIds"
  | "rsvpByMemberId"
  | "allTeams"
  | "startTimeSet"
>;

/** Compteurs de réponses. */
export type RsvpCounts = {
  /** Convocations (personnes × événements). */
  convoked: number;
  yes: number;
  maybe: number;
  no: number;
  /** Sans réponse. */
  none: number;
};

const EMPTY_COUNTS: RsvpCounts = { convoked: 0, yes: 0, maybe: 0, no: 0, none: 0 };

function addAnswer(counts: RsvpCounts, answer: string | undefined): RsvpCounts {
  return {
    convoked: counts.convoked + 1,
    yes: counts.yes + (answer === "yes" ? 1 : 0),
    maybe: counts.maybe + (answer === "maybe" ? 1 : 0),
    no: counts.no + (answer === "no" ? 1 : 0),
    none:
      counts.none +
      (answer === "yes" || answer === "maybe" || answer === "no" ? 0 : 1),
  };
}

function sumCounts(a: RsvpCounts, b: RsvpCounts): RsvpCounts {
  return {
    convoked: a.convoked + b.convoked,
    yes: a.yes + b.yes,
    maybe: a.maybe + b.maybe,
    no: a.no + b.no,
    none: a.none + b.none,
  };
}

/** Part des convocations avec un « oui » (0–100), `null` sans convocation. */
export function presenceRate(counts: RsvpCounts): number | null {
  return counts.convoked > 0
    ? Math.round((counts.yes / counts.convoked) * 100)
    : null;
}

/** Part des convocations avec une réponse (0–100), `null` sans convocation. */
export function responseRate(counts: RsvpCounts): number | null {
  return counts.convoked > 0
    ? Math.round(((counts.convoked - counts.none) / counts.convoked) * 100)
    : null;
}

/** Compteurs d’un événement, éventuellement limités à [onlyMemberIds]. */
export function eventCounts(
  event: AttendanceEvent,
  onlyMemberIds?: ReadonlySet<string>,
): RsvpCounts {
  let counts = EMPTY_COUNTS;
  for (const memberId of new Set(event.teamMemberIds)) {
    if (onlyMemberIds && !onlyMemberIds.has(memberId)) continue;
    counts = addAnswer(counts, event.rsvpByMemberId[memberId]);
  }
  return counts;
}

/**
 * Événements d’équipe passés avec au moins un convoqué : débutés avant
 * [now], ou, sans heure de début, dont la journée est finie. Les événements
 * « tout le club » (AG, fête…) ne comptent pas dans les présences d’équipe.
 */
export function pastConvokedEvents<T extends AttendanceEvent>(
  events: readonly T[],
  now: Date,
): T[] {
  return events.filter((event) => {
    if (event.allTeams === true || event.teamMemberIds.length === 0) return false;
    const start = new Date(event.startsAt);
    if (Number.isNaN(start.getTime())) return false;
    if (event.startTimeSet === false) {
      const nextDay = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + 1,
      );
      return nextDay.getTime() <= now.getTime();
    }
    return start.getTime() < now.getTime();
  });
}

/** Équipe analysée (rosters joueurs et coachs). */
export type AttendanceTeam = {
  id: string;
  name: string;
  category: string;
  playerIds: string[];
  /** Coachs de l'équipe (stats « joueurs et coachs »). */
  coachIds?: readonly string[];
};

/** Bilan d’un joueur sur la période. */
export type PlayerAttendance = RsvpCounts & {
  memberId: string;
  name: string;
  rate: number | null;
};

/** Bilan d’un événement (ligne de l’historique) : compteurs joueurs. */
export type EventAttendance = RsvpCounts & {
  id: string;
  title: string;
  type: EventType;
  startsAt: string;
  rate: number | null;
  /** Coachs de l'équipe convoqués / ayant répondu oui. */
  coachConvoked: number;
  coachYes: number;
};

/**
 * Bilan d’une équipe sur la période. Sans préfixe : joueurs seulement ;
 * `all*` : joueurs et coachs de l'équipe.
 */
export type TeamAttendance = {
  team: AttendanceTeam;
  /** Événements analysés. */
  eventCount: number;
  totals: RsvpCounts;
  rate: number | null;
  responseRate: number | null;
  /** Présence aux entraînements / aux matchs (tournois compris). */
  trainingRate: number | null;
  matchRate: number | null;
  allTotals: RsvpCounts;
  allRate: number | null;
  allResponseRate: number | null;
  players: PlayerAttendance[];
  coaches: PlayerAttendance[];
  events: EventAttendance[];
};

/** Seuil de non-réponse au-delà duquel un joueur est « à relancer » (%). */
export const LOW_RESPONSE_THRESHOLD = 50;

/** Minimum de convocations pour signaler un joueur (évite le bruit). */
export const MIN_CONVOCATIONS_FOR_ALERT = 3;

/** True si le joueur répond rarement : sans réponse plus d’une fois sur deux. */
export function isLowResponder(
  player: Pick<RsvpCounts, "convoked" | "none">,
): boolean {
  return (
    player.convoked >= MIN_CONVOCATIONS_FOR_ALERT &&
    (player.none / player.convoked) * 100 > LOW_RESPONSE_THRESHOLD
  );
}

/**
 * Bilan de [team] : événements passés de l’équipe, réponses de ses joueurs
 * et de ses coachs (rosters actuels). Un id présent dans les deux rosters
 * compte comme joueur. [names] : id de fiche → nom affiché.
 */
export function computeTeamAttendance(params: {
  team: AttendanceTeam;
  events: readonly AttendanceEvent[];
  names: ReadonlyMap<string, string>;
  now: Date;
}): TeamAttendance {
  const { team, names, now } = params;
  const roster = new Set(team.playerIds);
  const staff = new Set(
    (team.coachIds ?? []).filter((memberId) => !roster.has(memberId)),
  );
  const events = pastConvokedEvents(params.events, now).filter((event) =>
    event.teamIds.includes(team.id),
  );

  let totals = EMPTY_COUNTS;
  let coachTotals = EMPTY_COUNTS;
  let training = EMPTY_COUNTS;
  let match = EMPTY_COUNTS;
  const byMember = new Map<string, RsvpCounts>();
  const eventRows: EventAttendance[] = [];

  for (const event of events) {
    const counts = eventCounts(event, roster);
    const coachCounts = eventCounts(event, staff);
    if (counts.convoked === 0 && coachCounts.convoked === 0) continue;
    totals = sumCounts(totals, counts);
    coachTotals = sumCounts(coachTotals, coachCounts);
    if (event.type === "training") training = sumCounts(training, counts);
    if (event.type === "match" || event.type === "tournament") {
      match = sumCounts(match, counts);
    }
    for (const memberId of new Set(event.teamMemberIds)) {
      if (!roster.has(memberId) && !staff.has(memberId)) continue;
      byMember.set(
        memberId,
        addAnswer(byMember.get(memberId) ?? EMPTY_COUNTS, event.rsvpByMemberId[memberId]),
      );
    }
    eventRows.push({
      ...counts,
      id: event.id,
      title: event.title,
      type: event.type,
      startsAt: event.startsAt,
      rate: presenceRate(counts),
      coachConvoked: coachCounts.convoked,
      coachYes: coachCounts.yes,
    });
  }

  const memberRow = (memberId: string, fallback: string): PlayerAttendance => {
    const counts = byMember.get(memberId) ?? EMPTY_COUNTS;
    return {
      ...counts,
      memberId,
      name: names.get(memberId) ?? fallback,
      rate: presenceRate(counts),
    };
  };
  const allTotals = sumCounts(totals, coachTotals);

  return {
    team,
    eventCount: eventRows.length,
    totals,
    rate: presenceRate(totals),
    responseRate: responseRate(totals),
    trainingRate: presenceRate(training),
    matchRate: presenceRate(match),
    allTotals,
    allRate: presenceRate(allTotals),
    allResponseRate: responseRate(allTotals),
    players: sortPlayers(team.playerIds.map((id) => memberRow(id, "Joueur"))),
    coaches: sortPlayers([...staff].map((id) => memberRow(id, "Coach"))),
    events: eventRows.sort(
      (a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt),
    ),
  };
}

/**
 * Joueurs triés : sans convocation en dernier, puis présence croissante
 * (ceux qui décrochent en tête), puis nom.
 */
export function sortPlayers(players: PlayerAttendance[]): PlayerAttendance[] {
  return [...players].sort((a, b) => {
    if (a.rate === null && b.rate !== null) return 1;
    if (a.rate !== null && b.rate === null) return -1;
    if (a.rate !== null && b.rate !== null && a.rate !== b.rate) {
      return a.rate - b.rate;
    }
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });
}

/**
 * Bilan global de plusieurs équipes : chaque convocation (événement ×
 * membre) et chaque événement comptent une fois, même partagés par
 * plusieurs équipes. Joueurs seulement, et `all*` joueurs et coachs.
 */
export function summarizeAttendance(params: {
  teams: readonly AttendanceTeam[];
  events: readonly AttendanceEvent[];
  now: Date;
}): {
  totals: RsvpCounts;
  rate: number | null;
  responseRate: number | null;
  allTotals: RsvpCounts;
  allRate: number | null;
  allResponseRate: number | null;
  eventCount: number;
  lowResponders: number;
} {
  const teamIds = new Set(params.teams.map((team) => team.id));
  // Joueurs / coachs de chaque équipe : un membre compte comme joueur dans
  // une équipe où il joue, même s’il en entraîne une autre.
  const rosterOf = new Map(
    params.teams.map((team) => [team.id, new Set(team.playerIds)] as const),
  );
  const staffOf = new Map(
    params.teams.map(
      (team) =>
        [
          team.id,
          new Set(
            (team.coachIds ?? []).filter((id) => !team.playerIds.includes(id)),
          ),
        ] as const,
    ),
  );

  let totals = EMPTY_COUNTS;
  let allTotals = EMPTY_COUNTS;
  let eventCount = 0;
  const byPlayer = new Map<string, RsvpCounts>();
  for (const event of pastConvokedEvents(params.events, params.now)) {
    const eventTeams = event.teamIds.filter((id) => teamIds.has(id));
    if (eventTeams.length === 0) continue;
    const players = new Set<string>();
    const staff = new Set<string>();
    for (const teamId of eventTeams) {
      rosterOf.get(teamId)?.forEach((id) => players.add(id));
      staffOf.get(teamId)?.forEach((id) => staff.add(id));
    }
    players.forEach((id) => staff.delete(id));
    const playerCounts = eventCounts(event, players);
    const staffCounts = eventCounts(event, staff);
    if (playerCounts.convoked === 0 && staffCounts.convoked === 0) continue;
    eventCount += 1;
    totals = sumCounts(totals, playerCounts);
    allTotals = sumCounts(allTotals, sumCounts(playerCounts, staffCounts));
    for (const memberId of new Set(event.teamMemberIds)) {
      if (!players.has(memberId)) continue;
      byPlayer.set(
        memberId,
        addAnswer(
          byPlayer.get(memberId) ?? EMPTY_COUNTS,
          event.rsvpByMemberId[memberId],
        ),
      );
    }
  }
  return {
    totals,
    rate: presenceRate(totals),
    responseRate: responseRate(totals),
    allTotals,
    allRate: presenceRate(allTotals),
    allResponseRate: responseRate(allTotals),
    eventCount,
    lowResponders: [...byPlayer.values()].filter(isLowResponder).length,
  };
}

/** Période d’analyse proposée. */
export type AttendancePeriod = "30d" | "90d" | "season";

/**
 * Début de la période : 30 / 90 jours avant [now], ou début de saison
 * (1er août précédent, saison sportive août → juillet).
 */
export function attendancePeriodStart(
  period: AttendancePeriod,
  now: Date,
): Date {
  // Calcul calendaire : pas de jour en trop au changement d’heure.
  if (period === "30d") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  }
  if (period === "90d") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
  }
  const seasonYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(seasonYear, 7, 1);
}
