import { preferVenue } from "./ffvbMatchSheet";
import type { PoolMatch, PoolStandingRow } from "./ffvbParser";
import { FFVB_PROVIDER } from "./ffvbUrl";

/**
 * Plan de synchronisation des matchs d'une équipe liée à une poule FFVB
 * (fonctions pures). La synchro ne touche qu'aux champs « fédé » ; RDV,
 * convocations, RSVP et exclusions restent au coach.
 */

/** Score d'un match du point de vue de l'équipe du club. */
export type TeamMatchScore = {
  us: number;
  them: number;
  /** Sets « nous-eux » (`25-18`). */
  sets: string[];
  forfeit?: "us" | "them";
};

/** Champs d'événement alimentés par la fédération. */
export type FederationEventFields = {
  /** `YYYY-MM-DD` (l'appelant écrit `date` à minuit UTC). */
  dateIso: string;
  dateId: string;
  startTime: string | null;
  matchVenue: "home" | "away";
  location: string | null;
  opponentName: string;
  score: TeamMatchScore | null;
};

/** Champs fédé déjà stockés sur un événement existant. */
export type ExistingFederationEvent = {
  dateId: string | null;
  startTime: string | null;
  matchVenue: string | null;
  location: string | null;
  opponentName: string | null;
  score: TeamMatchScore | null;
  canceled: boolean;
};

/** Modifications à appliquer à un événement existant. */
export type FederationEventPatch = Partial<FederationEventFields>;

export type TeamSyncPlan = {
  creates: { eventId: string; fields: FederationEventFields; matchCode: string }[];
  updates: { eventId: string; patch: FederationEventPatch }[];
  unchanged: number;
  /** Événements FFVB de l'équipe absents de la poule (journalisés, jamais annulés). */
  missing: string[];
};

/**
 * Vrai pour un événement importé par la synchro fédérale de `teamId`
 * (`source` FFVB et id `ffvb_{teamId}_…`) : jamais un match saisi à la main.
 */
export function isImportedFederationEvent(eventId: string, source: unknown, teamId: string): boolean {
  return source === FFVB_PROVIDER && eventId.startsWith(`ffvb_${teamId}_`);
}

/** Id déterministe de l'événement d'un match pour une équipe du club. */
export function federationEventId(teamId: string, matchCode: string): string {
  return `ffvb_${teamId}_${matchCode.replace(/[^A-Za-z0-9]/g, "")}`;
}

/** Champs d'événement d'un match pour l'équipe `teamKey`, `null` si elle n'y joue pas ou s'il n'est pas programmé. */
export function toEventFields(match: PoolMatch, teamKey: string): FederationEventFields | null {
  const isHome = match.homeKey === teamKey;
  const isAway = match.awayKey === teamKey;
  if ((!isHome && !isAway) || !match.date) return null;

  let score: TeamMatchScore | null = null;
  if (match.score) {
    const us = isHome ? match.score.home : match.score.away;
    const them = isHome ? match.score.away : match.score.home;
    score = {
      us,
      them,
      sets: match.score.sets.map((set) => {
        const [home, away] = set.split("-");
        return isHome ? `${home}-${away}` : `${away}-${home}`;
      }),
    };
    if (match.score.forfeit) {
      const forfeitIsHome = match.score.forfeit === "home";
      score.forfeit = forfeitIsHome === isHome ? "us" : "them";
    }
  }

  return {
    dateIso: match.date,
    dateId: match.date.replace(/-/g, ""),
    startTime: match.time,
    matchVenue: isHome ? "home" : "away",
    location: match.venue,
    opponentName: isHome ? match.awayName : match.homeName,
    score,
  };
}

function sameScore(a: TeamMatchScore | null, b: TeamMatchScore | null): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Compare les matchs de la poule aux événements déjà créés pour l'équipe.
 * `existing` : événements FFVB de l'équipe, indexés par id. Une salle
 * absente côté fédé ne remplace jamais une salle connue.
 *
 * `previousMatches` : matchs de la synchro précédente. Un match déjà
 * importable alors mais sans événement a été supprimé par le coach : il
 * n'est pas recréé.
 */
export function planTeamSync(params: {
  teamId: string;
  teamKey: string;
  matches: PoolMatch[];
  existing: Map<string, ExistingFederationEvent>;
  previousMatches?: PoolMatch[];
}): TeamSyncPlan {
  const plan: TeamSyncPlan = { creates: [], updates: [], unchanged: 0, missing: [] };
  const seen = new Set<string>();
  const alreadyImported = new Set(
    (params.previousMatches ?? [])
      .filter((match) => toEventFields(match, params.teamKey) != null)
      .map((match) => match.code),
  );

  for (const match of params.matches) {
    const fields = toEventFields(match, params.teamKey);
    if (!fields) continue;
    const eventId = federationEventId(params.teamId, match.code);
    seen.add(eventId);
    const current = params.existing.get(eventId);
    if (!current) {
      if (!alreadyImported.has(match.code)) {
        plan.creates.push({ eventId, fields, matchCode: match.code });
      }
      continue;
    }
    if (current.canceled) {
      plan.unchanged += 1;
      continue;
    }

    const patch: FederationEventPatch = {};
    if (current.dateId !== fields.dateId) {
      patch.dateIso = fields.dateIso;
      patch.dateId = fields.dateId;
    }
    if (fields.startTime && current.startTime !== fields.startTime) {
      patch.startTime = fields.startTime;
    }
    if (current.matchVenue !== fields.matchVenue) patch.matchVenue = fields.matchVenue;
    if (fields.location && current.location !== fields.location) {
      patch.location = fields.location;
    }
    if (current.opponentName !== fields.opponentName) {
      patch.opponentName = fields.opponentName;
    }
    if (fields.score && !sameScore(current.score, fields.score)) {
      patch.score = fields.score;
    }

    if (Object.keys(patch).length === 0) {
      plan.unchanged += 1;
    } else {
      plan.updates.push({ eventId, patch });
    }
  }

  for (const eventId of params.existing.keys()) {
    if (!seen.has(eventId)) plan.missing.push(eventId);
  }
  return plan;
}

/** Équipes de la poule (classement, sinon matchs), triées par rang / nom. */
export function poolTeams(
  standings: PoolStandingRow[],
  matches: PoolMatch[],
): { key: string; name: string }[] {
  if (standings.length > 0) {
    return [...standings]
      .sort((a, b) => a.rank - b.rank)
      .map((row) => ({ key: row.key, name: row.name }));
  }
  const byKey = new Map<string, string>();
  for (const match of matches) {
    byKey.set(match.homeKey, match.homeName);
    byKey.set(match.awayKey, match.awayName);
  }
  return [...byKey.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/**
 * Fusionne les matchs lus avec ceux déjà stockés : une salle connue (surtout
 * une adresse complète déjà enrichie) est conservée si la fédé ne la publie
 * plus ou ne renvoie que le nom court.
 */
export function mergePoolMatches(
  fresh: PoolMatch[],
  previous: PoolMatch[],
): PoolMatch[] {
  const previousVenues = new Map(previous.map((match) => [match.code, match.venue]));
  return fresh.map((match) => {
    const venue = preferVenue(match.venue, previousVenues.get(match.code));
    return venue === match.venue ? match : { ...match, venue };
  });
}
