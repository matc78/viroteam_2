import type { ClubRecord } from "@/lib/firebase/clubService";
import {
  loadPlanningEventsForGuardian,
  loadPlanningPageData,
  type ClubEventView,
  type PlanningGuestDirectoryEntry,
  type TeamOption,
} from "@/lib/firebase/eventService";
import {
  getClubMember,
  getLinkedMemberId,
  loadMembersByRosterIds,
  type ClubMemberRecord,
} from "@/lib/firebase/memberService";
import {
  activeParentLinks,
  type ViroUserProfile,
} from "@/lib/firebase/types";
import { buildGuestDirectoryFromMembers } from "@/lib/planning/eventGuestRows";
import {
  memberMatchIds,
  rosterContains,
  teamsCoachedByViewer,
  teamsPlayedByViewer,
  viewerMatchIds,
} from "@/lib/teams/viewerTeamScope";

/** Event enrichi du club d’origine (agrégat multi-clubs). */
export type PersonalClubEventView = ClubEventView & {
  clubId: string;
  clubName: string;
  /** Clé stable `${clubId}:${eventId}` (évite collisions inter-clubs). */
  personalKey: string;
};

/** Club présent dans l’agrégat (filtre sidebar). */
export type PersonalPlanningClubOption = {
  id: string;
  name: string;
};

/** Résultat du planning personnel multi-clubs. */
export type PersonalPlanningData = {
  events: PersonalClubEventView[];
  /** Équipes par club (évite collisions d’IDs inter-clubs). */
  teamsByClub: Record<string, TeamOption[]>;
  clubs: PersonalPlanningClubOption[];
  /** Annuaire RSVP par club. */
  guestDirectoryByClub: Record<string, Record<string, PlanningGuestDirectoryEntry>>;
  /** memberId viewer par club (RSVP « moi »). */
  viewerMemberIdByClub: Record<string, string | null>;
  /** memberIds enfants actifs par club. */
  childMemberIdsByClub: Record<string, string[]>;
  /** Clubs dont le chargement a échoué (affichage soft). */
  failedClubNames: string[];
};

type PersonScope = {
  memberId: string;
  matchIds: Set<string>;
  teamIds: Set<string>;
};

type ClubSlice = {
  events: PersonalClubEventView[];
  teams: TeamOption[];
  guestDirectory: Record<string, PlanningGuestDirectoryEntry>;
  viewerMemberId: string | null;
  childMemberIds: string[];
};

/** True si le profil a une membership bureau sur ce club. */
function hasBureauMembership(
  profile: ViroUserProfile,
  clubId: string,
): boolean {
  return profile.clubMemberships.some(
    (membership) => membership.clubId === clubId,
  );
}

/**
 * Visibilité planning perso : équipes du scope ou convocation perso.
 * Exclut les events club-wide (`teamIds` vide) sauf invitation explicite.
 */
function eventVisibleToPersonalScope(params: {
  event: ClubEventView;
  viewerTeamIds: Set<string>;
  playerMatchIds: Set<string>;
}): boolean {
  if (
    params.event.teamMemberIds.some((id) => params.playerMatchIds.has(id))
  ) {
    return true;
  }
  if (params.event.teamIds.length === 0) return false;
  if (params.viewerTeamIds.size === 0) return false;
  return params.event.teamIds.some((teamId) =>
    params.viewerTeamIds.has(teamId),
  );
}

/** Construit le scope d’une personne (matchIds + équipes roster). */
function buildPersonScope(
  memberId: string,
  accountUid: string | null | undefined,
  teams: TeamOption[],
  extraTeamIds: string[] = [],
): PersonScope {
  const matchIds = memberMatchIds({
    memberId,
    accountUid: accountUid ?? null,
  });
  const teamIds = new Set(
    teams
      .filter(
        (team) =>
          rosterContains(team.playerIds, matchIds) ||
          rosterContains(team.coachIds, matchIds),
      )
      .map((team) => team.id),
  );
  for (const teamId of extraTeamIds) {
    if (teamId) teamIds.add(teamId);
  }
  return { memberId, matchIds, teamIds };
}

/**
 * Charge et filtre les events d’un club pour le viewer + enfants liés.
 * Admin : pas le club entier — uniquement roster perso / coach / enfants.
 */
async function loadPersonalEventsForClub(params: {
  club: ClubRecord;
  uid: string;
  profile: ViroUserProfile;
  range: { start: Date; end: Date };
}): Promise<ClubSlice | null> {
  const { club, uid, profile, range } = params;
  const isMember = hasBureauMembership(profile, club.id);
  const childLinks = activeParentLinks(profile).filter(
    (link) => link.clubId === club.id,
  );

  if (!isMember && childLinks.length === 0) {
    return null;
  }

  const viewerMemberId = isMember
    ? await getLinkedMemberId(club.id, uid)
    : null;
  const selfMatchIds = viewerMatchIds({
    uid,
    memberId: viewerMemberId,
  });

  const childMembers = await Promise.all(
    childLinks.map((link) => getClubMember(club.id, link.memberId)),
  );
  const childMemberById = new Map<string, ClubMemberRecord | null>();
  childLinks.forEach((link, index) => {
    childMemberById.set(link.memberId, childMembers[index] ?? null);
  });

  let teams: TeamOption[];
  let rawEvents: ClubEventView[];

  if (isMember) {
    const page = await loadPlanningPageData(club.id, {
      start: range.start,
      end: range.end,
    });
    teams = page.teams;
    rawEvents = page.events;
  } else {
    const childTeamIds = [
      ...new Set(
        childMembers.flatMap((member) => member?.teamIds ?? []).filter(Boolean),
      ),
    ];
    const loaded = await loadPlanningEventsForGuardian(club.id, childTeamIds, {
      start: range.start,
      end: range.end,
    });
    teams = loaded.teams;
    rawEvents = loaded.events;
  }

  const coachedTeamIds = new Set(
    teamsCoachedByViewer(teams, selfMatchIds).map((team) => team.id),
  );
  const playedTeamIds = new Set(
    teamsPlayedByViewer(teams, selfMatchIds).map((team) => team.id),
  );
  const selfTeamIds = new Set([...coachedTeamIds, ...playedTeamIds]);

  const childScopes = childLinks.map((link) => {
    const member = childMemberById.get(link.memberId) ?? null;
    return buildPersonScope(
      link.memberId,
      member?.accountUid,
      teams,
      member?.teamIds ?? [],
    );
  });

  const relevantTeamIds = new Set(selfTeamIds);
  for (const child of childScopes) {
    for (const teamId of child.teamIds) relevantTeamIds.add(teamId);
  }

  const visibleEvents = rawEvents.filter((event) => {
    if (
      selfMatchIds.size > 0 &&
      eventVisibleToPersonalScope({
        event,
        viewerTeamIds: selfTeamIds,
        playerMatchIds: selfMatchIds,
      })
    ) {
      return true;
    }
    for (const child of childScopes) {
      if (
        eventVisibleToPersonalScope({
          event,
          viewerTeamIds: child.teamIds,
          playerMatchIds: child.matchIds,
        })
      ) {
        return true;
      }
    }
    return false;
  });

  const scopedTeams = teams.filter((team) => relevantTeamIds.has(team.id));
  const rosterIds = [
    ...new Set(
      scopedTeams.flatMap((team) => [...team.playerIds, ...team.coachIds]),
    ),
  ];
  const rosterMembers =
    rosterIds.length > 0
      ? await loadMembersByRosterIds(club.id, rosterIds)
      : [];
  const guestDirectory = buildGuestDirectoryFromMembers(rosterMembers);

  const clubName = club.name.trim() || "Club";
  const events: PersonalClubEventView[] = visibleEvents.map((event) => ({
    ...event,
    clubId: club.id,
    clubName,
    personalKey: `${club.id}:${event.id}`,
    teamLabels: [clubName, ...event.teamLabels.filter(Boolean)],
  }));

  return {
    events,
    teams: scopedTeams,
    guestDirectory,
    viewerMemberId,
    childMemberIds: childScopes.map((child) => child.memberId),
  };
}

/**
 * Agrège le planning personnel sur tous les clubs du profil
 * (memberships bureau + liens parent actifs).
 * Un club en erreur n’empêche pas les autres (allSettled).
 */
export async function loadPersonalPlanningAcrossClubs(params: {
  uid: string;
  profile: ViroUserProfile;
  clubs: ClubRecord[];
  range: { start: Date; end: Date };
}): Promise<PersonalPlanningData> {
  const clubById = new Map(params.clubs.map((club) => [club.id, club]));
  const clubIds = new Set<string>();
  for (const membership of params.profile.clubMemberships) {
    if (membership.clubId) clubIds.add(membership.clubId);
  }
  for (const link of activeParentLinks(params.profile)) {
    clubIds.add(link.clubId);
  }

  const clubsToLoad = [...clubIds]
    .map((id) => clubById.get(id))
    .filter((club): club is ClubRecord => Boolean(club));

  const settled = await Promise.allSettled(
    clubsToLoad.map((club) =>
      loadPersonalEventsForClub({
        club,
        uid: params.uid,
        profile: params.profile,
        range: params.range,
      }),
    ),
  );

  const events: PersonalClubEventView[] = [];
  const teamsByClub: Record<string, TeamOption[]> = {};
  const guestDirectoryByClub: Record<
    string,
    Record<string, PlanningGuestDirectoryEntry>
  > = {};
  const viewerMemberIdByClub: Record<string, string | null> = {};
  const childMemberIdsByClub: Record<string, string[]> = {};
  const clubs: PersonalPlanningClubOption[] = [];
  const failedClubNames: string[] = [];

  for (let index = 0; index < clubsToLoad.length; index += 1) {
    const club = clubsToLoad[index]!;
    const result = settled[index]!;
    if (result.status === "rejected") {
      failedClubNames.push(club.name.trim() || "Club");
      continue;
    }
    const slice = result.value;
    if (!slice) continue;

    clubs.push({ id: club.id, name: club.name.trim() || "Club" });
    viewerMemberIdByClub[club.id] = slice.viewerMemberId;
    childMemberIdsByClub[club.id] = slice.childMemberIds;
    teamsByClub[club.id] = slice.teams;
    guestDirectoryByClub[club.id] = slice.guestDirectory;
    events.push(...slice.events);
  }

  events.sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
  clubs.sort((left, right) => left.name.localeCompare(right.name, "fr"));

  return {
    events,
    teamsByClub,
    clubs,
    guestDirectoryByClub,
    viewerMemberIdByClub,
    childMemberIdsByClub,
    failedClubNames,
  };
}

/**
 * memberId RSVP uniquement si la personne est dans `teamMemberIds`.
 * Pas de fallback (évite RSVP ambigu sur events sans audience).
 */
export function resolvePersonalRsvpMemberId(params: {
  event: PersonalClubEventView;
  viewerMemberId: string | null | undefined;
  childMemberIds: string[];
  viewerUid?: string | null;
}): string | null {
  const audience = new Set(
    params.event.teamMemberIds.map(String).filter(Boolean),
  );
  if (audience.size === 0) return null;

  const viewerCandidates = [
    params.viewerMemberId,
    params.viewerUid,
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const candidate of viewerCandidates) {
    if (audience.has(candidate)) {
      return params.viewerMemberId?.trim() || candidate;
    }
  }
  for (const childId of params.childMemberIds) {
    if (audience.has(childId)) return childId;
  }
  return null;
}

/**
 * True si la tuile « Mon planning » a un intérêt (plusieurs profils à agréger) :
 * - plusieurs clubs, ou
 * - plusieurs enfants liés, ou
 * - soi-même licencié + au moins un enfant.
 * Parent d’un seul enfant (sans membership) ou 1 club sans enfant → masquée.
 */
export function shouldShowPersonalPlanningTile(
  profile: ViroUserProfile | null,
): boolean {
  if (!profile) return false;
  const membershipClubIds = new Set<string>();
  for (const membership of profile.clubMemberships) {
    if (membership.clubId) membershipClubIds.add(membership.clubId);
  }
  const children = activeParentLinks(profile);
  const clubIds = new Set(membershipClubIds);
  for (const link of children) {
    clubIds.add(link.clubId);
  }
  if (clubIds.size > 1) return true;
  if (children.length > 1) return true;
  if (membershipClubIds.size > 0 && children.length > 0) return true;
  return false;
}

/**
 * Options « club » pour colorer le calendrier (un calendrier = un club).
 * Utilisé comme faux TeamOption dans expandEventsToLabelBlocks.
 */
export function clubsAsTeamOptions(
  clubs: PersonalPlanningClubOption[],
): TeamOption[] {
  return clubs.map((club) => ({
    id: club.id,
    name: club.name,
    category: "",
    playerIds: [],
    coachIds: [],
  }));
}

/** Events colorés par club (teamIds remplacés par clubId pour les blocs). */
export function eventsColoredByClub(
  events: PersonalClubEventView[],
): ClubEventView[] {
  return events.map((event) => ({
    ...event,
    id: event.personalKey,
    teamIds: [event.clubId],
    teamLabels: [event.clubName, ...event.teamLabels.slice(1)],
  }));
}
