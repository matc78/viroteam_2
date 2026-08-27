import {
  AnnouncementTargetTypes,
  MemberRoles,
} from "@/lib/firebase/constants";
import type { TeamOption } from "@/lib/firebase/eventService";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import {
  DEFAULT_COACH_PERMISSIONS,
  type CoachPermissions,
} from "@/lib/auth/coachPermissions";
import {
  memberIsCoachOfPlayerTeams,
  memberMatchIds,
  rosterContains,
  teamsCoachedByViewer,
  teamsPlayedByViewer,
  viewerMatchIds,
  viewerTeamIdsForRole,
} from "@/lib/teams/viewerTeamScope";

/** Contexte de permissions Bureau pour le club actif. */
export type BureauPermissionContext = {
  role: string | null;
  uid: string | null;
  /** memberId lié au compte sur ce club, si connu. */
  linkedMemberId: string | null;
};

/** Capacités UI / actions dérivées du rôle club (+ flags coach). */
export type BureauCapabilities = {
  role: string | null;
  isAdmin: boolean;
  isCoach: boolean;
  isPlayer: boolean;
  canAccessFeesAdmin: boolean;
  canAccessFeesSelf: boolean;
  /** Coach avec canViewFees : suivi cotisations en lecture. */
  canAccessFeesCoachRead: boolean;
  canAccessAnnouncementsPage: boolean;
  canCreateEvent: boolean;
  canManageAnnouncements: boolean;
  canAddMember: boolean;
  canEditRole: boolean;
  canRemoveMember: boolean;
  canManageParents: boolean;
  canImportMembers: boolean;
  canCreateTeam: boolean;
  canManageTeamRoster: boolean;
  canSeeAllContacts: boolean;
  canAccessEquipment: boolean;
  canAccessSettings: boolean;
  navHrefs: readonly string[];
};

const NAV_ADMIN = [
  "/home",
  "/members",
  "/planning",
  "/fees",
  "/announcements",
  "/equipment",
  "/settings",
] as const;

const NAV_COACH_BASE = [
  "/home",
  "/members",
  "/planning",
  "/announcements",
] as const;

const NAV_PLAYER = ["/home", "/members", "/planning", "/fees"] as const;

/** Construit les capacités Bureau selon le rôle + droits coach du club. */
export function bureauCapabilities(
  role: string | null,
  coachPermissions: CoachPermissions = DEFAULT_COACH_PERMISSIONS,
): BureauCapabilities {
  const isAdmin = role === MemberRoles.admin;
  const isCoach = role === MemberRoles.coach;
  const isPlayer = role === MemberRoles.player;
  const coach = coachPermissions;

  const canCreateEvent = isAdmin || (isCoach && coach.canCreateEvents);
  const canAddMember = isAdmin || (isCoach && coach.canInvitePlayers);
  const canManageTeamRoster =
    isAdmin || (isCoach && coach.canManageTeamRoster);
  const canAccessFeesCoachRead = isCoach && coach.canViewFees;

  let navHrefs: readonly string[] = NAV_ADMIN;
  if (isCoach) {
    const coachNav = canAccessFeesCoachRead
      ? [...NAV_COACH_BASE, "/fees"]
      : [...NAV_COACH_BASE];
    navHrefs = [...coachNav, "/settings"];
  } else if (isPlayer) {
    navHrefs = [...NAV_PLAYER, "/settings"];
  }

  return {
    role,
    isAdmin,
    isCoach,
    isPlayer,
    canAccessFeesAdmin: isAdmin,
    canAccessFeesSelf: isPlayer || isAdmin,
    canAccessFeesCoachRead,
    canAccessAnnouncementsPage: isAdmin || isCoach,
    canCreateEvent,
    canManageAnnouncements: isAdmin || isCoach,
    canAddMember,
    canEditRole: isAdmin,
    canRemoveMember: isAdmin,
    canManageParents: isAdmin,
    canImportMembers: isAdmin,
    canCreateTeam: isAdmin,
    canManageTeamRoster,
    canSeeAllContacts: isAdmin,
    canAccessEquipment: isAdmin,
    /** Page paramètres : compte pour tous ; section club réservée admin. */
    canAccessSettings: true,
    navHrefs,
  };
}

/** True si le viewer peut ajouter un joueur à cette équipe. */
export function canAddPlayerToTeam(params: {
  role: string | null;
  uid: string | null;
  linkedMemberId?: string | null;
  team: TeamOption;
  coachPermissions?: CoachPermissions;
}): boolean {
  if (params.role === MemberRoles.admin) return true;
  if (params.role !== MemberRoles.coach) return false;
  const permissions = params.coachPermissions ?? DEFAULT_COACH_PERMISSIONS;
  if (!permissions.canManageTeamRoster) return false;
  const matchIds = viewerMatchIds({
    uid: params.uid,
    memberId: params.linkedMemberId,
  });
  return rosterContains(params.team.coachIds, matchIds);
}

/** True si le viewer peut retirer un joueur de l’équipe. */
export function canRemovePlayerFromTeam(role: string | null): boolean {
  return role === MemberRoles.admin;
}

/** True si le viewer peut ajouter / retirer un coach sur l’équipe. */
export function canManageTeamCoaches(role: string | null): boolean {
  return role === MemberRoles.admin;
}

/**
 * Autorise l’affichage email / téléphone d’un membre.
 * Admin : tout. Joueur : uniquement ses coachs d’équipe. Coach : jamais (hors soi).
 */
export function canSeeMemberContact(params: {
  role: string | null;
  viewerUid: string | null;
  viewerLinkedMemberId?: string | null;
  target: Pick<ClubMemberRecord, "memberId" | "accountUid">;
  teams: TeamOption[];
}): boolean {
  if (params.role === MemberRoles.admin) return true;

  const viewerIds = viewerMatchIds({
    uid: params.viewerUid,
    memberId: params.viewerLinkedMemberId,
  });
  const targetIds = memberMatchIds(params.target);
  for (const id of targetIds) {
    if (viewerIds.has(id)) return true;
  }

  if (params.role !== MemberRoles.player) return false;

  const playerTeamIds = new Set(
    viewerTeamIdsForRole({
      role: MemberRoles.player,
      teams: params.teams,
      matchIds: viewerIds,
    }),
  );
  const coachRosterIds = new Set<string>();
  for (const team of params.teams) {
    if (!playerTeamIds.has(team.id)) continue;
    for (const coachId of team.coachIds) {
      if (coachId) coachRosterIds.add(coachId);
    }
  }
  return memberIsCoachOfPlayerTeams({
    member: params.target,
    coachRosterIds,
  });
}

/** Équipes entraînées par le viewer (rôle coach). */
export function coachedTeamsForViewer(params: {
  role: string | null;
  uid: string | null;
  linkedMemberId?: string | null;
  teams: TeamOption[];
}): TeamOption[] {
  if (params.role === MemberRoles.admin) return params.teams;
  if (params.role !== MemberRoles.coach) return [];
  return teamsCoachedByViewer(
    params.teams,
    viewerMatchIds({
      uid: params.uid,
      memberId: params.linkedMemberId,
    }),
  );
}

/**
 * Équipes visibles pour le viewer (admin = toutes, coach = coached,
 * joueur = ses équipes).
 */
export function teamsVisibleToViewer(params: {
  role: string | null;
  uid: string | null;
  linkedMemberId?: string | null;
  teams: TeamOption[];
}): TeamOption[] {
  if (params.role === MemberRoles.admin) return params.teams;
  const matchIds = viewerMatchIds({
    uid: params.uid,
    memberId: params.linkedMemberId,
  });
  if (params.role === MemberRoles.coach) {
    return teamsCoachedByViewer(params.teams, matchIds);
  }
  if (params.role === MemberRoles.player) {
    return teamsPlayedByViewer(params.teams, matchIds);
  }
  return [];
}

/**
 * Membres visibles pour le viewer : admin = tous ;
 * coach/joueur = membres des équipes dans le scope (+ soi-même).
 */
export function membersVisibleToViewer<
  T extends { memberId: string; accountUid?: string | null },
>(params: {
  role: string | null;
  uid: string | null;
  linkedMemberId?: string | null;
  teams: TeamOption[];
  members: T[];
}): T[] {
  if (params.role === MemberRoles.admin) return params.members;

  const viewerIds = viewerMatchIds({
    uid: params.uid,
    memberId: params.linkedMemberId,
  });
  const scopedTeams = teamsVisibleToViewer({
    role: params.role,
    uid: params.uid,
    linkedMemberId: params.linkedMemberId,
    teams: params.teams,
  });
  const rosterIds = new Set<string>();
  for (const team of scopedTeams) {
    for (const id of team.playerIds) {
      if (id) rosterIds.add(id);
    }
    for (const id of team.coachIds) {
      if (id) rosterIds.add(id);
    }
  }

  return params.members.filter((member) => {
    const ids = memberMatchIds(member);
    for (const id of ids) {
      if (viewerIds.has(id) || rosterIds.has(id)) return true;
    }
    return false;
  });
}

/** Libellé court du rôle pour le chip header. */
export function bureauRoleChipLabel(role: string | null): string {
  if (role === MemberRoles.admin) return "Admin";
  if (role === MemberRoles.coach) return "Coach";
  if (role === MemberRoles.player) return "Joueur";
  return "Membre";
}

/** True si la route bureau est autorisée pour ce rôle. */
export function isBureauRouteAllowed(
  pathname: string,
  caps: BureauCapabilities,
): boolean {
  if (pathname === "/home" || pathname.startsWith("/home/")) return true;
  for (const href of caps.navHrefs) {
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
