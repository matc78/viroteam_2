import { stringArray, uniq } from "./common";

/**
 * Fonctions pures du calcul de `users/{uid}.parentTeamIds` (testables sans
 * Firestore).
 */

const MEMBER_STATUS_ARCHIVED = "archived";

export type ChildTeams = {
  /** `members/{id}.status` — une fiche archivée ne compte plus. */
  status: string;
  /** `members/{id}.teamIds` ∪ équipes dont le roster contient la fiche. */
  teamIds: string[];
};

/** Vrai si la fiche enfant est encore active (non archivée). */
export function isActiveChild(status: unknown): boolean {
  return String(status ?? "") !== MEMBER_STATUS_ARCHIVED;
}

/**
 * Union triée et dédoublonnée des `teamIds` des fiches enfants actives.
 */
export function computeParentTeamIds(children: ChildTeams[]): string[] {
  const ids = children
    .filter((child) => isActiveChild(child.status))
    .flatMap((child) => child.teamIds.filter((id) => id.length > 0));
  return uniq(ids).sort();
}

/** Différence d'identifiants entre deux versions d'une liste (roster). */
export function diffIds(
  before: string[],
  after: string[],
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: uniq(after.filter((id) => !beforeSet.has(id))),
    removed: uniq(before.filter((id) => !afterSet.has(id))),
  };
}

/** Identifiants joueurs d'un doc `teams/{teamId}` (players uniquement). */
export function playerIdsOf(teamData: Record<string, unknown> | undefined): string[] {
  return uniq(stringArray(teamData?.playerIds));
}

/** Vrai si les deux listes contiennent les mêmes ids (ordre indifférent). */
export function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}
