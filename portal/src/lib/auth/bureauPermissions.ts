import { AnnouncementTargetTypes } from "@/lib/firebase/constants";
import type { TeamOption } from "@/lib/firebase/eventService";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import {
  can,
  canAddMembers,
  canCreateEvents,
  canPublishAnnouncements,
  type ClubAccess,
} from "@/lib/auth/permissions";
import {
  coachRosterIdsForPlayerTeams,
  rosterTeamsForViewer,
  teamsPlayedByViewer,
} from "@/lib/teams/viewerTeamScope";

export {
  canAddPlayerToTeam,
  canShareTeamInvite,
} from "@/lib/auth/permissions";

/**
 * Capacités du Bureau pour le club actif, dérivées des droits du compte
 * (\`ClubAccess\`). Seul endroit qui traduit les droits en navigation et en
 * actions de page ; les règles Firestore et les callables restent la vraie
 * barrière.
 */
export type BureauCapabilities = {
  /** Droits effectifs bruts (helpers par équipe : \`@/lib/auth/permissions\`). */
  access: ClubAccess;
  /** Droit Administrateur (attribuer des droits, réglages coach, Stripe). */
  isClubAdmin: boolean;
  /** Coach d’au moins une équipe. */
  isTeamCoach: boolean;
  /** Encadrement : au moins un droit, ou coach d’équipe. */
  isStaff: boolean;
  /** Voit toutes les équipes et tous les membres du club. */
  seesWholeClub: boolean;
  canViewFees: boolean;
  canManageFees: boolean;
  /** Peut publier une annonce (club, ou ses équipes si coach). */
  canPublishAnnouncements: boolean;
  /** Annonces de tout le club (toutes cibles, toutes annonces). */
  canManageAnnouncements: boolean;
  /** Peut créer un événement (club, ou ses équipes si coach). */
  canCreateEvent: boolean;
  /** Planning de tout le club. */
  canManageEvents: boolean;
  canAddMember: boolean;
  /** Fiches, contacts, parents, retrait, import, invitations groupées. */
  canManageMembers: boolean;
  /** Attribuer des droits (droit Administrateur). */
  canEditRights: boolean;
  canManageTeams: boolean;
  canManageEquipment: boolean;
  canViewActivity: boolean;
  canManageClubSettings: boolean;
  navHrefs: readonly string[];
};

/** Routes accessibles à tout membre, hors navigation principale. */
const ALWAYS_ALLOWED_ROUTES = [
  "/home",
  "/my-planning",
  "/messages",
  "/fees",
  "/settings",
] as const;

/** Construit les capacités Bureau à partir des droits du compte. */
export function bureauCapabilities(access: ClubAccess): BureauCapabilities {
  const canManageMembers = can(access, "manageMembers");
  const canManageTeams = can(access, "manageTeams");
  const canManageEvents = can(access, "manageEvents");
  const canViewFees = can(access, "viewFees");
  const canViewActivity = can(access, "viewActivity");
  const canManageEquipment = can(access, "manageEquipment");
  const canPublish = canPublishAnnouncements(access);

  const navHrefs = [
    "/home",
    ...(access.isStaff ? ["/members"] : ["/team"]),
    "/planning",
    "/fees",
    ...(canPublish ? ["/announcements"] : []),
    ...(canManageEquipment ? ["/equipment"] : []),
    ...(canViewActivity ? ["/activity"] : []),
    "/settings",
  ];

  return {
    access,
    isClubAdmin: access.isAdmin,
    isTeamCoach: access.isTeamCoach,
    isStaff: access.isStaff,
    seesWholeClub: canManageMembers || canManageTeams || canManageEvents,
    canViewFees,
    canManageFees: can(access, "manageFees"),
    canPublishAnnouncements: canPublish,
    canManageAnnouncements: can(access, "manageAnnouncements"),
    canCreateEvent: canCreateEvents(access),
    canManageEvents,
    canAddMember: canAddMembers(access),
    canManageMembers,
    canEditRights: access.isAdmin,
    canManageTeams,
    canManageEquipment,
    canViewActivity,
    canManageClubSettings: can(access, "manageClubSettings"),
    navHrefs,
  };
}

/*
 * Le viewer se matche dans les rosters par son uid : sa fiche vit à
 * `members/{uid}` (une seule clé membre). Sans fiche, l’uid ne matche rien.
 */

/**
 * Autorise l’affichage e-mail / téléphone d’un membre : droit membres, sa
 * propre fiche, ou les coachs des équipes où le viewer joue.
 */
export function canSeeMemberContact(params: {
  caps: BureauCapabilities;
  viewerUid: string | null;
  target: Pick<ClubMemberRecord, "memberId">;
  teams: TeamOption[];
}): boolean {
  if (params.caps.canManageMembers) return true;
  if (params.viewerUid && params.target.memberId === params.viewerUid) {
    return true;
  }
  const playerTeamIds = new Set(
    teamsPlayedByViewer(params.teams, params.viewerUid).map((team) => team.id),
  );
  return coachRosterIdsForPlayerTeams(params.teams, playerTeamIds).has(
    params.target.memberId,
  );
}

/**
 * Équipes entraînées par le compte, d'après sa fiche (`access.coachTeamIds`,
 * dérivé serveur) : sert d'autorisation, jamais recalculé depuis les rosters.
 */
export function coachedTeamsForViewer(params: {
  access: ClubAccess;
  teams: TeamOption[];
}): TeamOption[] {
  return params.teams.filter((team) =>
    params.access.coachTeamIds.includes(team.id),
  );
}

/**
 * Équipes visibles pour le viewer : tout le club avec un droit de gestion
 * des membres, équipes ou planning ; sinon ses rosters (coach ∪ joueur).
 */
export function teamsVisibleToViewer(params: {
  caps: BureauCapabilities;
  uid: string | null;
  teams: TeamOption[];
}): TeamOption[] {
  if (params.caps.seesWholeClub) return params.teams;
  return rosterTeamsForViewer(params.teams, params.uid);
}

/**
 * Membres visibles pour le viewer : tout le club (voir
 * [teamsVisibleToViewer]) ; sinon les membres de ses équipes (+ soi-même).
 */
export function membersVisibleToViewer<T extends { memberId: string }>(params: {
  caps: BureauCapabilities;
  uid: string | null;
  teams: TeamOption[];
  members: T[];
}): T[] {
  if (params.caps.seesWholeClub) return params.members;

  const visibleIds = new Set<string>();
  if (params.uid) visibleIds.add(params.uid);
  for (const team of teamsVisibleToViewer(params)) {
    for (const id of team.playerIds) {
      if (id) visibleIds.add(id);
    }
    for (const id of team.coachIds) {
      if (id) visibleIds.add(id);
    }
  }

  return params.members.filter((member) => visibleIds.has(member.memberId));
}

/** True si la route bureau est autorisée par les droits du compte. */
export function isBureauRouteAllowed(
  pathname: string,
  caps: BureauCapabilities,
): boolean {
  const matches = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  return (
    ALWAYS_ALLOWED_ROUTES.some(matches) || caps.navHrefs.some(matches)
  );
}

/** Onglets principaux espace famille (hors deep links). */
export const FAMILY_NAV_HREFS = [
  "/family",
  "/family/team",
  "/family/planning",
] as const;

/** Routes famille hors nav (cotisations, paramètres, planning perso). */
const FAMILY_DEEP_LINK_ROUTES = [
  "/family/fees",
  "/family/settings",
  "/family/my-planning",
  "/family/messages",
] as const;

/** True si la route famille est autorisée. */
export function isFamilyRouteAllowed(pathname: string): boolean {
  if (pathname === "/family") return true;
  for (const href of FAMILY_NAV_HREFS) {
    if (href !== "/family" && (pathname === href || pathname.startsWith(`${href}/`))) {
      return true;
    }
  }
  for (const href of FAMILY_DEEP_LINK_ROUTES) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  }
  return false;
}

/**
 * True si une annonce est visible pour un coach
 * (tout le club, ou au moins une de ses équipes).
 */
export function announcementVisibleToCoach(params: {
  announcement: { targetType: string; targetIds: string[] };
  coachedTeamIds: Set<string>;
}): boolean {
  const { targetType, targetIds } = params.announcement;
  if (
    targetType === AnnouncementTargetTypes.allMembers ||
    targetType === "all"
  ) {
    return true;
  }
  if (targetType === AnnouncementTargetTypes.teams) {
    return targetIds.some((id) => params.coachedTeamIds.has(id));
  }
  return false;
}
