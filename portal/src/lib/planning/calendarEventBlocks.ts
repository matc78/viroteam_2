import type {
  ClubEventView,
  PlanningPersonOption,
  TeamOption,
} from "@/lib/firebase/eventService";
import {
  colorForFilter,
  type FilterColorKind,
} from "@/lib/planning/calendarColors";

/** Filtres latéraux traités comme calendriers (labels) Google-like. */
export type PlanningLabelFilters = {
  teamIds: string[];
  coachIds: string[];
  categories: string[];
  playerIds: string[];
};

/** Bloc d'affichage agenda : un événement × un label sélectionné. */
export type CalendarEventBlock = {
  blockId: string;
  event: ClubEventView;
  color: string;
  labelKind: FilterColorKind | "fallback";
  labelId: string;
};

type MatchedLabel = {
  kind: FilterColorKind;
  id: string;
};

/** Indique si au moins un label est coché dans la sidebar. */
export function hasActiveLabelFilters(filters: PlanningLabelFilters): boolean {
  return (
    filters.teamIds.length > 0 ||
    filters.coachIds.length > 0 ||
    filters.categories.length > 0 ||
    filters.playerIds.length > 0
  );
}

function collectMatchIds(
  people: PlanningPersonOption[],
  selectedIds: string[],
): Map<string, string> {
  const selected = new Set(selectedIds);
  /** matchId → id option filtre (pour couleur / blockId stables). */
  const matchIdToFilterId = new Map<string, string>();
  for (const person of people) {
    if (!selected.has(person.id)) continue;
    for (const matchId of person.matchIds) {
      matchIdToFilterId.set(matchId, person.id);
    }
  }
  return matchIdToFilterId;
}

/**
 * Labels sélectionnés qui matchent un événement (équipes, coachs,
 * catégories, joueurs).
 */
function matchingLabelsForEvent(
  event: ClubEventView,
  teamById: Map<string, TeamOption>,
  filters: PlanningLabelFilters,
  coachMatchToFilterId: Map<string, string>,
  playerMatchToFilterId: Map<string, string>,
): MatchedLabel[] {
  const matched: MatchedLabel[] = [];
  const seen = new Set<string>();

  function pushLabel(kind: FilterColorKind, id: string) {
    const key = `${kind}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    matched.push({ kind, id });
  }

  for (const teamId of filters.teamIds) {
    if (event.teamIds.includes(teamId)) {
      pushLabel("team", teamId);
    }
  }

  if (filters.categories.length > 0) {
    const selectedCategories = new Set(filters.categories);
    for (const teamId of event.teamIds) {
      const category = teamById.get(teamId)?.category ?? "";
      if (category && selectedCategories.has(category)) {
        pushLabel("category", category);
      }
    }
  }

  if (filters.coachIds.length > 0) {
    const matchedCoachFilterIds = new Set<string>();
    for (const teamId of event.teamIds) {
      for (const coachId of teamById.get(teamId)?.coachIds ?? []) {
        const filterId = coachMatchToFilterId.get(coachId);
        if (filterId) matchedCoachFilterIds.add(filterId);
      }
    }
    for (const coachFilterId of matchedCoachFilterIds) {
      pushLabel("coach", coachFilterId);
    }
  }

  if (filters.playerIds.length > 0) {
    const matchedPlayerFilterIds = new Set<string>();
    for (const memberId of event.teamMemberIds) {
      const filterId = playerMatchToFilterId.get(memberId);
      if (filterId) matchedPlayerFilterIds.add(filterId);
    }
    for (const teamId of event.teamIds) {
      for (const playerId of teamById.get(teamId)?.playerIds ?? []) {
        const filterId = playerMatchToFilterId.get(playerId);
        if (filterId) matchedPlayerFilterIds.add(filterId);
      }
    }
    for (const playerFilterId of matchedPlayerFilterIds) {
      pushLabel("player", playerFilterId);
    }
  }

  return matched;
}

/**
 * Transforme les événements en blocs agenda style Google Calendar :
 * chaque label coché qui matche produit une case colorée distincte.
 * Sans label coché : aucun bloc (calendriers tous masqués).
 */
export function expandEventsToLabelBlocks(
  events: ClubEventView[],
  teams: TeamOption[],
  coaches: PlanningPersonOption[],
  players: PlanningPersonOption[],
  filters: PlanningLabelFilters,
): CalendarEventBlock[] {
  if (!hasActiveLabelFilters(filters)) {
    return [];
  }

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const coachMatchToFilterId = collectMatchIds(coaches, filters.coachIds);
  const playerMatchToFilterId = collectMatchIds(players, filters.playerIds);
  const blocks: CalendarEventBlock[] = [];

  for (const event of events) {
    const labels = matchingLabelsForEvent(
      event,
      teamById,
      filters,
      coachMatchToFilterId,
      playerMatchToFilterId,
    );
    for (const label of labels) {
      blocks.push({
        blockId: `${event.id}::${label.kind}:${label.id}`,
        event,
        color: colorForFilter(label.kind, label.id),
        labelKind: label.kind,
        labelId: label.id,
      });
    }
  }

  return blocks;
}
