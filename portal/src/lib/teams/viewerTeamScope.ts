import type { TeamOption } from "@/lib/firebase/eventService";

/*
 * « Une seule clé membre » : rosters (`playerIds` / `coachIds`), audiences
 * (`teamMemberIds` / `excludedMemberIds`) et RSVP sont clés par l’id de fiche,
 * égal à l’uid du compte quand la fiche est liée. Un viewer se matche donc
 * par un seul id (`null` : pas de fiche, ne matche rien).
 */

/** True si [memberId] figure dans le roster. */
export function rosterContains(
  rosterIds: string[],
  memberId: string | null | undefined,
): boolean {
  return Boolean(memberId) && rosterIds.includes(memberId!);
}

/** Équipes où le membre apparaît dans coachIds. */
export function teamsCoachedByViewer(
  teams: TeamOption[],
  memberId: string | null | undefined,
): TeamOption[] {
  return teams.filter((team) => rosterContains(team.coachIds, memberId));
}

/** Équipes où le membre apparaît dans playerIds. */
export function teamsPlayedByViewer(
  teams: TeamOption[],
  memberId: string | null | undefined,
): TeamOption[] {
  return teams.filter((team) => rosterContains(team.playerIds, memberId));
}

/**
 * Équipes du membre via roster : coachIds ∪ playerIds.
 * Couvre le double rôle (ex. coach d’une équipe et joueur d’une autre).
 */
export function rosterTeamsForViewer(
  teams: TeamOption[],
  memberId: string | null | undefined,
): TeamOption[] {
  return teams.filter(
    (team) =>
      rosterContains(team.coachIds, memberId) ||
      rosterContains(team.playerIds, memberId),
  );
}

/** IDs d’équipes du viewer selon son rôle club. */
export function viewerTeamIdsForRole(params: {
  role: string | null;
  teams: TeamOption[];
  memberId: string | null | undefined;
}): string[] {
  if (params.role === "admin") {
    return params.teams.map((team) => team.id);
  }
  if (params.role === "coach") {
    // Coach (+ éventuel rôle joueur) : union des rosters.
    return rosterTeamsForViewer(params.teams, params.memberId).map(
      (team) => team.id,
    );
  }
  if (params.role === "player") {
    return teamsPlayedByViewer(params.teams, params.memberId).map(
      (team) => team.id,
    );
  }
  return [];
}

/** IDs des coachs (roster) des équipes du joueur. */
export function coachRosterIdsForPlayerTeams(
  teams: TeamOption[],
  playerTeamIds: Set<string>,
): Set<string> {
  const coachIds = new Set<string>();
  for (const team of teams) {
    if (!playerTeamIds.has(team.id)) continue;
    for (const coachId of team.coachIds) {
      if (coachId) coachIds.add(coachId);
    }
  }
  return coachIds;
}

/** Filtre les événements dont l’audience croise les équipes du viewer. */
export function eventTouchesTeams(
  event: { teamIds: string[]; allTeams?: boolean },
  viewerTeamIds: Set<string>,
): boolean {
  if (viewerTeamIds.size === 0) return false;
  if (event.allTeams) return true;
  // Sans teamIds → audience club entière.
  if (event.teamIds.length === 0) return true;
  return event.teamIds.some((teamId) => viewerTeamIds.has(teamId));
}

/**
 * True si le membre a été retiré des convoqués : l’événement lui est alors
 * totalement invisible.
 */
export function isExcludedFromEvent(
  event: { excludedMemberIds?: string[] },
  memberId: string | null | undefined,
): boolean {
  return rosterContains(event.excludedMemberIds ?? [], memberId);
}

/**
 * Filtre events pour un joueur (équipes ou convocation personnelle).
 * Un joueur retiré des convoqués (`excludedMemberIds`) ne voit pas l’event.
 */
export function eventVisibleToPlayer(params: {
  event: {
    teamIds: string[];
    teamMemberIds: string[];
    excludedMemberIds?: string[];
    allTeams?: boolean;
  };
  viewerTeamIds: Set<string>;
  memberId: string | null | undefined;
}): boolean {
  if (isExcludedFromEvent(params.event, params.memberId)) return false;
  if (rosterContains(params.event.teamMemberIds, params.memberId)) return true;
  return eventTouchesTeams(params.event, params.viewerTeamIds);
}
