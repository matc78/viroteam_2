/**
 * Modèle du classement FFVB côté portail : lecture des documents
 * `teams/{teamId}.federation` et `teams/{teamId}/federation/{standings|matches}`
 * écrits par la synchro (Functions). Miroir de `lib/models/team_federation.dart`.
 */

/** Lien d’une équipe vers sa poule fédérale (`teams/{id}.federation`). */
export type TeamFederationLink = {
  provider: string;
  /** Clé de l’équipe du club dans la poule (`usm-de-viroflay`). */
  teamKey: string;
  /** Nom publié par la fédération. */
  teamName: string;
  url: string | null;
  season: string | null;
  pool: string | null;
  poolLabel: string | null;
  lastSyncAt: Date | null;
  lastSyncFailed: boolean;
  /** Joueurs non convoqués par défaut sur les matchs importés. */
  excludedMemberIds: string[];
};

/** Équipe du club liée à une poule. */
export type FederationTeam = {
  id: string;
  clubId: string;
  name: string;
  category: string;
  playerIds: string[];
  coachIds: string[];
  federation: TeamFederationLink;
};

/** Ligne du classement d’une poule. */
export type PoolStandingRow = {
  key: string;
  rank: number;
  name: string;
  points: number;
  played: number;
  won: number;
  lost: number;
  forfeits: number;
  wins30: number;
  wins31: number;
  wins32: number;
  losses23: number;
  losses13: number;
  losses03: number;
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
};

/** Classement d’une poule (`federation/standings`). */
export type PoolStandings = {
  rows: PoolStandingRow[];
  /** Clé de l’équipe du club dans la poule. */
  myTeamKey: string;
  poolLabel: string | null;
  fetchedAt: Date | null;
};

/** Score publié d’un match (recevant / visiteur). */
export type PoolMatchScore = {
  home: number;
  away: number;
  /** Sets « recevant-visiteur » (`25-18`). */
  sets: string[];
  forfeitByHome: boolean;
  forfeitByAway: boolean;
};

/** Match de la poule (`federation/matches`). */
export type PoolMatch = {
  code: string;
  round: number;
  /** Jour `YYYY-MM-DD`, `null` si non programmé. */
  date: string | null;
  /** `HH:mm`, `null` si non programmé. */
  time: string | null;
  homeKey: string;
  homeName: string;
  awayKey: string;
  awayName: string;
  venue: string | null;
  score: PoolMatchScore | null;
};

/** Données d’une poule lues pour une équipe. */
export type PoolData = {
  standings: PoolStandings | null;
  matches: PoolMatch[];
};

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function int(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : 0;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  const withToDate = value as { toDate?: () => Date } | null;
  if (withToDate && typeof withToDate.toDate === "function") {
    return withToDate.toDate();
  }
  return null;
}

/** Lit `teams/{id}.federation` ; `null` si absent ou incomplet. */
export function parseFederationLink(raw: unknown): TeamFederationLink | null {
  const data = asRecord(raw);
  if (!data) return null;
  const provider = str(data.provider);
  const teamKey = str(data.teamKey);
  if (!provider || !teamKey) return null;
  return {
    provider,
    teamKey,
    teamName: str(data.teamName) ?? teamKey,
    url: str(data.url),
    season: str(data.season),
    pool: str(data.pool),
    poolLabel: str(data.poolLabel),
    lastSyncAt: toDate(data.lastSyncAt),
    lastSyncFailed: data.lastSyncStatus === "error",
    excludedMemberIds: strings(data.excludedMemberIds),
  };
}

/**
 * Contrôle local rapide d’un lien de poule FFVB (page calendrier
 * `vbspo_calendrier.php` sur ffvbbeach.org) ; le serveur revalide.
 */
export function looksLikeFfvbPoolLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      url.hostname.toLowerCase().endsWith("ffvbbeach.org") &&
      url.pathname.endsWith("vbspo_calendrier.php")
    );
  } catch {
    return false;
  }
}

/**
 * Identifiant de la poule : l’URL canonique écrite par les Functions, sinon
 * `fournisseur|saison|poule`. Deux équipes d’un club dans la même poule
 * partagent cette clé (même règle que `TeamFederationLink.poolKey`).
 */
export function poolKeyOf(link: TeamFederationLink): string {
  return link.url ?? `${link.provider}|${link.season ?? ""}|${link.pool ?? link.teamKey}`;
}

/** Lit le document `standings` ; `null` s’il n’existe pas. */
export function parsePoolStandings(raw: unknown): PoolStandings | null {
  const data = asRecord(raw);
  if (!data) return null;
  const rows = (Array.isArray(data.rows) ? data.rows : [])
    .map(asRecord)
    .filter((row): row is Raw => row !== null)
    .map(
      (row): PoolStandingRow => ({
        key: str(row.key) ?? "",
        rank: int(row.rank),
        name: str(row.name) ?? "",
        points: int(row.points),
        played: int(row.played),
        won: int(row.won),
        lost: int(row.lost),
        forfeits: int(row.forfeits),
        wins30: int(row.wins30),
        wins31: int(row.wins31),
        wins32: int(row.wins32),
        losses23: int(row.losses23),
        losses13: int(row.losses13),
        losses03: int(row.losses03),
        setsFor: int(row.setsFor),
        setsAgainst: int(row.setsAgainst),
        pointsFor: int(row.pointsFor),
        pointsAgainst: int(row.pointsAgainst),
      }),
    )
    .filter((row) => row.key)
    .sort((a, b) => a.rank - b.rank);
  return {
    rows,
    myTeamKey: str(data.teamKey) ?? "",
    poolLabel: str(data.poolLabel),
    fetchedAt: toDate(data.fetchedAt),
  };
}

function parseScore(raw: unknown): PoolMatchScore | null {
  const data = asRecord(raw);
  if (!data) return null;
  if (typeof data.home !== "number" || typeof data.away !== "number") {
    return null;
  }
  return {
    home: Math.trunc(data.home),
    away: Math.trunc(data.away),
    sets: strings(data.sets),
    forfeitByHome: data.forfeit === "home",
    forfeitByAway: data.forfeit === "away",
  };
}

/** Lit la liste `matches` du document `matches` (vide si absent). */
export function parsePoolMatches(raw: unknown): PoolMatch[] {
  const data = asRecord(raw);
  const list = data && Array.isArray(data.matches) ? data.matches : [];
  return list
    .map(asRecord)
    .filter((match): match is Raw => match !== null)
    .map((match): PoolMatch => {
      const dateIso = str(match.date);
      return {
        code: str(match.code) ?? "",
        round: int(match.round),
        date: dateIso ? dateIso.slice(0, 10) : null,
        time: str(match.time),
        homeKey: str(match.homeKey) ?? "",
        homeName: str(match.homeName) ?? "",
        awayKey: str(match.awayKey) ?? "",
        awayName: str(match.awayName) ?? "",
        venue: str(match.venue),
        score: parseScore(match.score),
      };
    })
    .filter((match) => match.code);
}

/** True si [sport] est du volley (seul sport synchronisé avec la fédération). */
export function isVolleyballSport(sport: string | null | undefined): boolean {
  return (sport ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .includes("volley");
}
