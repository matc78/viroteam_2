import type {
  PoolMatch,
  PoolStandingRow,
  PoolStandings,
} from "@/lib/standings/standingsTypes";

/**
 * Saison d’une équipe de la poule (forme, bilans, parcours). Miroir de
 * `lib/services/standings/pool_team_season.dart` (mêmes règles).
 */

const LOWERCASE_WORDS = new Set([
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "et",
  "en",
  "sur",
]);

const FORM_LENGTH = 5;

function capitalize(word: string): string {
  return word ? word[0]!.toUpperCase() + word.slice(1) : word;
}

function formatWord(word: string, keepAcronym: boolean): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (LOWERCASE_WORDS.has(lower)) return lower;
  // Sigles courts (USM, AS, ES) gardés en capitales, hors mots composés.
  const letters = word.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (
    keepAcronym &&
    letters.length > 0 &&
    letters.length <= 3 &&
    word === word.toUpperCase()
  ) {
    return word;
  }
  if (lower.indexOf("'") === 1) {
    // D'ARCY → d'Arcy
    return lower.slice(0, 2) + capitalize(lower.slice(2));
  }
  return capitalize(lower);
}

/**
 * Nom d’équipe FFVB (en capitales) lisible : `USM DE VIROFLAY` →
 * `USM de Viroflay`, `MARLY-LE-ROI VOLLEY-BALL` → `Marly-le-Roi Volley-Ball`.
 */
export function displayPoolTeamName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const parts = word.split("-");
      const formatted = parts
        .map((part) => formatWord(part, parts.length === 1))
        .join("-");
      return index === 0 ? capitalize(formatted) : formatted;
    })
    .join(" ");
}

/** Un match du parcours d’une équipe, de son point de vue. */
export type PoolTeamMatch = {
  code: string;
  round: number;
  date: string | null;
  time: string | null;
  isHome: boolean;
  opponentKey: string;
  opponentName: string;
  venue: string | null;
  /** Sets gagnés, `null` si non joué. */
  us: number | null;
  them: number | null;
  /** Sets « équipe-adversaire ». */
  sets: string[];
  forfeit: boolean;
};

/** True si le match a un score. */
export function isPlayed(match: PoolTeamMatch): boolean {
  return match.us !== null && match.them !== null;
}

/** True si l’équipe a gagné le match. */
export function isWin(match: PoolTeamMatch): boolean {
  return isPlayed(match) && match.us! > match.them!;
}

/** Saison d’une équipe : classement, forme, bilans, salles, parcours. */
export type PoolTeamSeason = {
  key: string;
  name: string;
  isMyTeam: boolean;
  row: PoolStandingRow | null;
  /** 5 derniers résultats, du plus ancien au plus récent (`true` = victoire). */
  form: boolean[];
  homeWon: number;
  homeLost: number;
  awayWon: number;
  awayLost: number;
  /** Salles où l’équipe reçoit, sans doublon. */
  homeVenues: string[];
  /** Matchs joués, du plus récent au plus ancien. */
  played: PoolTeamMatch[];
  /** Matchs à venir, du plus proche au plus lointain. */
  upcoming: PoolTeamMatch[];
};

function compareMatches(a: PoolMatch, b: PoolMatch): number {
  if (a.date && b.date) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.time ?? "").localeCompare(b.time ?? "");
  }
  if (!a.date && b.date) return 1;
  if (a.date && !b.date) return -1;
  return a.round - b.round;
}

function teamMatch(match: PoolMatch, teamKey: string): PoolTeamMatch {
  const isHome = match.homeKey === teamKey;
  const score = match.score;
  return {
    code: match.code,
    round: match.round,
    date: match.date,
    time: match.time,
    isHome,
    opponentKey: isHome ? match.awayKey : match.homeKey,
    opponentName: isHome ? match.awayName : match.homeName,
    venue: match.venue,
    us: score ? (isHome ? score.home : score.away) : null,
    them: score ? (isHome ? score.away : score.home) : null,
    sets: (score?.sets ?? []).map((set) => {
      if (isHome) return set;
      const parts = set.split("-");
      return parts.length === 2 ? `${parts[1]}-${parts[0]}` : set;
    }),
    forfeit: Boolean(score && (score.forfeitByHome || score.forfeitByAway)),
  };
}

/**
 * Calcule la saison de l’équipe [teamKey] à partir du classement et des
 * matchs de la poule ; `null` si l’équipe n’apparaît nulle part.
 */
export function buildPoolTeamSeason(params: {
  standings: PoolStandings | null;
  matches: PoolMatch[];
  teamKey: string;
}): PoolTeamSeason | null {
  const { standings, matches, teamKey } = params;
  const row = standings?.rows.find((item) => item.key === teamKey) ?? null;
  const teamMatches = matches
    .filter((match) => match.homeKey === teamKey || match.awayKey === teamKey)
    .sort(compareMatches);
  if (!row && teamMatches.length === 0) return null;

  const views = teamMatches.map((match) => teamMatch(match, teamKey));
  const playedChronological = views.filter(isPlayed);
  const upcoming = views.filter((match) => !isPlayed(match));

  let homeWon = 0;
  let homeLost = 0;
  let awayWon = 0;
  let awayLost = 0;
  for (const match of playedChronological) {
    const won = isWin(match);
    if (match.isHome) {
      if (won) homeWon += 1;
      else homeLost += 1;
    } else if (won) {
      awayWon += 1;
    } else {
      awayLost += 1;
    }
  }

  const homeVenues: string[] = [];
  for (const match of views) {
    if (match.isHome && match.venue && !homeVenues.includes(match.venue)) {
      homeVenues.push(match.venue);
    }
  }

  const first = teamMatches[0];
  const rawName =
    row?.name ??
    (first ? (first.homeKey === teamKey ? first.homeName : first.awayName) : "");

  return {
    key: teamKey,
    name: rawName,
    isMyTeam: standings?.myTeamKey === teamKey,
    row,
    form: playedChronological.slice(-FORM_LENGTH).map(isWin),
    homeWon,
    homeLost,
    awayWon,
    awayLost,
    homeVenues,
    played: [...playedChronological].reverse(),
    upcoming,
  };
}
