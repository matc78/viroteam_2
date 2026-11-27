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
  canManageTeamFederation,
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

/**
 * Routes accessibles à tout membre, hors navigation principale.
 * `/account` porte les réglages du compte ; `/settings` = paramètres du club.
 */
const ALWAYS_ALLOWED_ROUTES = [
  "/home",
  "/my-planning",
  "/standings",
  "/messages",
  "/fees",
  "/account",
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
  const canManageClubSettings = can(access, "manageClubSettings");
  const seesWholeClub = canManageMembers || canManageTeams || canManageEvents;
  // Même règle que `ClubAccess.canOpenMembers` (app) : droit membres ou
  // équipes, capacité d'inviter, ou coach d'équipe. Sinon (ex. responsable
  // cotisations ou planning sans équipe), le compte garde la vue Équipe.
  const showsMembersPage =
    canAddMembers(access) ||
    canManageMembers ||
    canManageTeams ||
    access.isTeamCoach;

  const navHrefs = [
    "/home",
    ...(showsMembersPage ? ["/members", "/teams"] : ["/team"]),
    "/planning",
    // Présences : staff (tout le club) ou coach (ses équipes).
    ...(seesWholeClub || access.isTeamCoach ? ["/attendance"] : []),
    // Classements de tout le club : administrateurs (chacun garde
    // « Mes classements », multi-clubs, pour ses équipes).
    ...(access.isAdmin ? ["/club-standings"] : []),
    // Séances : préparation réservée aux coachs d’une équipe.
    ...(access.isTeamCoach ? ["/sessions"] : []),
    "/fees",
    ...(canPublish ? ["/announcements"] : []),
    ...(canManageEquipment ? ["/equipment"] : []),
    ...(canViewActivity ? ["/activity"] : []),
    ...(canManageClubSettings ? ["/settings"] : []),
  ];

  return {
    access,
    isClubAdmin: access.isAdmin,
    isTeamCoach: access.isTeamCoach,
    isStaff: access.isStaff,
    seesWholeClub,
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
    canManageClubSettings,
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
  "/family/fees",
] as const;

/** Routes famille hors nav (compte, planning perso, messagerie). */
const FAMILY_DEEP_LINK_ROUTES = [
  "/family/settings",
  "/family/my-planning",
  "/family/standings",
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
