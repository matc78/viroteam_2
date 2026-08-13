import type {
  PlanningPersonOption,
  TeamOption,
} from "@/lib/firebase/eventService";

/** Type d'invité sélectionnable dans le picker. */
export type PlanningGuestKind = "team" | "category" | "person";

/** Invité sélectionné (équipe, catégorie ou personne). */
export type PlanningGuestSelection = {
  kind: PlanningGuestKind;
  id: string;
};

/**
 * Résout les sélections d'invités en `teamIds` et `teamMemberIds`
 * pour la création d'événement.
 */
export function resolveGuestAudience(
  selections: PlanningGuestSelection[],
  teams: TeamOption[],
  people: PlanningPersonOption[],
): { teamIds: string[]; teamMemberIds: string[] } {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const personById = new Map(people.map((person) => [person.id, person]));
  const teamIds = new Set<string>();
  const memberIds = new Set<string>();

  function addTeam(team: TeamOption) {
    teamIds.add(team.id);
    for (const playerId of team.playerIds) {
      if (playerId) memberIds.add(playerId);
    }
  }

  for (const selection of selections) {
    if (selection.kind === "team") {
      const team = teamById.get(selection.id);
      if (team) addTeam(team);
      continue;
    }
    if (selection.kind === "category") {
      for (const team of teams) {
        if (team.category === selection.id) addTeam(team);
      }
      continue;
    }
    const person = personById.get(selection.id);
    if (!person) continue;
    for (const matchId of person.matchIds) {
      if (matchId) memberIds.add(matchId);
    }
  }

  return {
    teamIds: Array.from(teamIds),
    teamMemberIds: Array.from(memberIds),
  };
}
