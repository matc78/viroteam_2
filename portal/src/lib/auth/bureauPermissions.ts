import {
  AnnouncementTargetTypes,
  MemberRoles,
} from "@/lib/firebase/constants";
import type { TeamOption } from "@/lib/firebase/eventService";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import {
  memberIsCoachOfPlayerTeams,
  memberMatchIds,
  rosterContains,
  teamsCoachedByViewer,
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

/** Capacités UI / actions dérivées du rôle club. */
export type BureauCapabilities = {
  role: string | null;
  isAdmin: boolean;
  isCoach: boolean;
  isPlayer: boolean;
  canAccessFeesAdmin: boolean;
  canAccessFeesSelf: boolean;
  canAccessAnnouncementsPage: boolean;
  canCreateEvent: boolean;
  canManageAnnouncements: boolean;
  canAddMember: boolean;
  canEditRole: boolean;
  canRemoveMember: boolean;
  canManageParents: boolean;
  canImportMembers: boolean;
  canCreateTeam: boolean;
  canSeeAllContacts: boolean;
  navHrefs: readonly string[];
};

const NAV_ADMIN = [
  "/home",
  "/members",
  "/planning",
  "/fees",
  "/announcements",
] as const;

const NAV_COACH = ["/home", "/members", "/planning", "/announcements"] as const;

const NAV_PLAYER = ["/home", "/members", "/planning", "/fees"] as const;

/** Construit les capacités Bureau selon le rôle du club actif. */
export function bureauCapabilities(
  role: string | null,
): BureauCapabilities {
  const isAdmin = role === MemberRoles.admin;
  const isCoach = role === MemberRoles.coach;
  const isPlayer = role === MemberRoles.player;

  return {
    role,
    isAdmin,
    isCoach,
    isPlayer,
    canAccessFeesAdmin: isAdmin,
    canAccessFeesSelf: isPlayer || isAdmin,
    canAccessAnnouncementsPage: isAdmin || isCoach,
    canCreateEvent: isAdmin || isCoach,
    canManageAnnouncements: isAdmin || isCoach,
    canAddMember: isAdmin || isCoach,
    canEditRole: isAdmin,
    canRemoveMember: isAdmin,
    canManageParents: isAdmin,
    canImportMembers: isAdmin,
    canCreateTeam: isAdmin,
    canSeeAllContacts: isAdmin,
    navHrefs: isAdmin
      ? NAV_ADMIN
      : isCoach
        ? NAV_COACH
        : isPlayer
          ? NAV_PLAYER
          : NAV_ADMIN,
  };
}

/** True si le viewer peut ajouter un joueur à cette équipe. */
export function canAddPlayerToTeam(params: {
  role: string | null;
  uid: string | null;
  linkedMemberId?: string | null;
  team: TeamOption;
}): boolean {
  if (params.role === MemberRoles.admin) return true;
  if (params.role !== MemberRoles.coach) return false;
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
