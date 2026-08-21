const STORAGE_PREFIX = "viro.teamCardsCollapsed.";

function parseCollapsedIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

/** Lit les IDs d’équipes dont la carte est réduite (défaut = agrandie). */
export function readCollapsedTeamIds(clubId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(
      parseCollapsedIds(localStorage.getItem(`${STORAGE_PREFIX}${clubId}`)),
    );
  } catch {
    return new Set();
  }
}

/** Persiste les IDs d’équipes réduites pour un club. */
export function writeCollapsedTeamIds(
  clubId: string,
  collapsedIds: ReadonlySet<string>,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${clubId}`,
      JSON.stringify([...collapsedIds]),
    );
  } catch {
    // Ignore quota / mode privé.
  }
}

/**
 * Indique si la carte équipe doit être agrandie.
 * Absent du stockage = agrandie (premier passage).
 */
export function isTeamCardExpanded(clubId: string, teamId: string): boolean {
  return !readCollapsedTeamIds(clubId).has(teamId);
}

/** Mémorise l’état agrandi / réduit d’une carte équipe. */
export function setTeamCardExpanded(
  clubId: string,
  teamId: string,
  expanded: boolean,
): void {
  const collapsedIds = readCollapsedTeamIds(clubId);
  if (expanded) collapsedIds.delete(teamId);
  else collapsedIds.add(teamId);
  writeCollapsedTeamIds(clubId, collapsedIds);
}
