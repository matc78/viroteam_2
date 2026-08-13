import type { PlanningSidebarFilters } from "@/components/dashboard/PlanningSidebar";

const STORAGE_PREFIX = "viro.planningFilters.";

/** Filtres planning vides (aucune sélection). */
export function emptyPlanningFilters(): PlanningSidebarFilters {
  return {
    teamIds: [],
    coachIds: [],
    categories: [],
    playerIds: [],
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseStoredFilters(raw: string | null): PlanningSidebarFilters | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (
      !isStringArray(record.teamIds) ||
      !isStringArray(record.coachIds) ||
      !isStringArray(record.categories) ||
      !isStringArray(record.playerIds)
    ) {
      return null;
    }
    return {
      teamIds: record.teamIds,
      coachIds: record.coachIds,
      categories: record.categories,
      playerIds: record.playerIds,
    };
  } catch {
    return null;
  }
}

/** Lit les filtres planning mémorisés pour un club. */
export function readPlanningFilters(clubId: string): PlanningSidebarFilters {
  if (typeof window === "undefined") return emptyPlanningFilters();
  try {
    const stored = parseStoredFilters(
      localStorage.getItem(`${STORAGE_PREFIX}${clubId}`),
    );
    return stored ?? emptyPlanningFilters();
  } catch {
    return emptyPlanningFilters();
  }
}

/** Persiste les filtres planning pour un club. */
export function writePlanningFilters(
  clubId: string,
  filters: PlanningSidebarFilters,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${clubId}`, JSON.stringify(filters));
  } catch {
    // Ignore quota / mode privé.
  }
}

type FilterOptionIds = {
  teamIds: ReadonlySet<string>;
  coachIds: ReadonlySet<string>;
  categories: ReadonlySet<string>;
  playerIds: ReadonlySet<string>;
};

/** Retire les sélections qui ne correspondent plus aux options du club. */
export function sanitizePlanningFilters(
  filters: PlanningSidebarFilters,
  options: FilterOptionIds,
): PlanningSidebarFilters {
  return {
    teamIds: filters.teamIds.filter((id) => options.teamIds.has(id)),
    coachIds: filters.coachIds.filter((id) => options.coachIds.has(id)),
    categories: filters.categories.filter((id) => options.categories.has(id)),
    playerIds: filters.playerIds.filter((id) => options.playerIds.has(id)),
  };
}

/** Indique si deux états de filtres sont identiques. */
export function arePlanningFiltersEqual(
  a: PlanningSidebarFilters,
  b: PlanningSidebarFilters,
): boolean {
  return (
    sameIds(a.teamIds, b.teamIds) &&
    sameIds(a.coachIds, b.coachIds) &&
    sameIds(a.categories, b.categories) &&
    sameIds(a.playerIds, b.playerIds)
  );
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}
