import type { TeamOption } from "@/lib/firebase/eventService";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";

/** Identifiants possibles pour matcher un viewer dans les rosters équipes. */
export function viewerMatchIds(params: {
  uid: string | null | undefined;
  memberId?: string | null;
  accountUid?: string | null;
}): Set<string> {
  const ids = new Set<string>();
  for (const value of [params.uid, params.memberId, params.accountUid]) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) ids.add(trimmed);
  }
  return ids;
}

/** Identifiants possibles d’un membre pour le matching roster. */
export function memberMatchIds(member: {
  memberId: string;
  accountUid?: string | null;
}): Set<string> {
  return viewerMatchIds({
    uid: null,
    memberId: member.memberId,
    accountUid: member.accountUid,
  });
}

/** True si le set d’IDs intersecte le roster. */
export function rosterContains(
  rosterIds: string[],
  matchIds: Set<string>,
): boolean {
  return rosterIds.some((id) => matchIds.has(id));
}

/** Équipes où le viewer apparaît dans coachIds. */
export function teamsCoachedByViewer(
  teams: TeamOption[],
  matchIds: Set<string>,
): TeamOption[] {
  return teams.filter((team) => rosterContains(team.coachIds, matchIds));
}

/** Équipes où le viewer apparaît dans playerIds. */
export function teamsPlayedByViewer(
  teams: TeamOption[],
  matchIds: Set<string>,
): TeamOption[] {
  return teams.filter((team) => rosterContains(team.playerIds, matchIds));
}

/**
 * Équipes du viewer via roster : coachIds ∪ playerIds.
 * Couvre le double rôle (ex. coach d’une équipe et joueur d’une autre).
 */
export function rosterTeamsForViewer(
  teams: TeamOption[],
  matchIds: Set<string>,
): TeamOption[] {
  const byId = new Map<string, TeamOption>();
  for (const team of teamsCoachedByViewer(teams, matchIds)) {
    byId.set(team.id, team);
  }
  for (const team of teamsPlayedByViewer(teams, matchIds)) {
    byId.set(team.id, team);
  }
  return [...byId.values()];
}

/** IDs d’équipes du viewer selon son rôle club. */
export function viewerTeamIdsForRole(params: {
  role: string | null;
  teams: TeamOption[];
  matchIds: Set<string>;
}): string[] {
  if (params.role === "admin") {
    return params.teams.map((team) => team.id);
  }
  if (params.role === "coach") {
    // Coach (+ éventuel rôle joueur) : union des rosters.
    return rosterTeamsForViewer(params.teams, params.matchIds).map(
      (team) => team.id,
    );
  }
  if (params.role === "player") {
    return teamsPlayedByViewer(params.teams, params.matchIds).map(
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

/** True si le membre est coach d’au moins une équipe du joueur. */
export function memberIsCoachOfPlayerTeams(params: {
  member: Pick<ClubMemberRecord, "memberId" | "accountUid">;
  coachRosterIds: Set<string>;
}): boolean {
  const ids = memberMatchIds(params.member);
  for (const id of ids) {
    if (params.coachRosterIds.has(id)) return true;
  }
  return false;
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

/** Filtre events pour un joueur (équipes ou convocation personnelle). */
export function eventVisibleToPlayer(params: {
  event: {
    teamIds: string[];
    teamMemberIds: string[];
    allTeams?: boolean;
  };
  viewerTeamIds: Set<string>;
  playerMatchIds: Set<string>;
}): boolean {
  if (
    params.event.teamMemberIds.some((id) => params.playerMatchIds.has(id))
  ) {
    return true;
  }
  return eventTouchesTeams(params.event, params.viewerTeamIds);
}

/**
 * Visibilité planning membre (non-admin) : équipes roster ∪ convocations perso.
 * Utilisé aussi pour un coach qui joue dans d’autres équipes.
 */
export function eventVisibleToRosterMember(params: {
  event: {
    teamIds: string[];
    teamMemberIds: string[];
    allTeams?: boolean;
  };
  rosterTeamIds: Set<string>;
  matchIds: Set<string>;
}): boolean {
  return eventVisibleToPlayer({
    event: params.event,
    viewerTeamIds: params.rosterTeamIds,
    playerMatchIds: params.matchIds,
  });
}
