/**
 * Migration « rôles → droits » (fonctions pures, testables avec
 * `node --test`). Utilisée par `tool/migrate_roles_to_permissions.mjs`.
 *
 * Avant : `members.role` (player / coach / admin) + `clubs.adminIds`
 * autorisaient. Après : seule `members.permissions` fait foi ;
 * `members.coachTeamIds` porte la relation coach d'équipe et `clubs.adminIds`
 * devient un index dérivé.
 */
import { stringArray } from "./common";
import {
  PERMISSION_ADMIN,
  grantsAdmin,
  normalizePermissions,
  type ClubPermission,
} from "./permissionsCatalog";

/**
 * Ancien rôle (v1) → droits, propre à la migration : les modèles ont
 * disparu du catalogue.
 */
const LEGACY_ROLE_PERMISSIONS = {
  admin: [PERMISSION_ADMIN],
  coach: ["viewActivity"],
  player: [],
} as const satisfies Record<string, readonly ClubPermission[]>;

export type MigrationDoc = { id: string; data: Record<string, unknown> };

export type MemberMigrationPatch = {
  memberId: string;
  permissions: ClubPermission[];
  coachTeamIds: string[];
};

export type ClubMigrationPlan = {
  /** Fiches dont `permissions` ou `coachTeamIds` doit être écrit. */
  memberPatches: MemberMigrationPatch[];
  /** Nouvel index `adminIds`, ou `null` s'il est déjà à jour. */
  adminIds: string[] | null;
  report: {
    /** Le club n'aurait aucun admin lié à un compte. */
    noLinkedAdmin: boolean;
    /** Uids de l'ancien `adminIds` sans fiche `members/{uid}`. */
    adminIdsWithoutMember: string[];
    /** Fiches admin non liées à un compte (hors index, ne peuvent pas agir). */
    unlinkedAdminMemberIds: string[];
    /** Anciens coachs qui n'entraînent aucune équipe. */
    coachesWithoutTeam: string[];
  };
};

const MEMBER_STATUS_ARCHIVED = "archived";

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function isLinked(member: Record<string, unknown>): boolean {
  return String(member.accountUid ?? member.userId ?? "").trim().length > 0;
}

/**
 * Droits d'une fiche après migration. Une fiche qui porte déjà `permissions`
 * est conservée telle quelle (migration relançable) ; sinon l'ancien rôle est
 * converti par son modèle. `wasInAdminIds` : l'ancien `adminIds` donnait le
 * droit admin au même titre que `role == admin`.
 */
export function migratedPermissions(params: {
  member: Record<string, unknown>;
  wasInAdminIds: boolean;
  clubGrantedViewFeesToCoaches: boolean;
}): ClubPermission[] {
  const { member } = params;
  if (member.status === MEMBER_STATUS_ARCHIVED) return [];
  if (Array.isArray(member.permissions)) {
    return normalizePermissions(member.permissions);
  }
  const role = String(member.role ?? "player");
  if (role === "admin" || params.wasInAdminIds) {
    return normalizePermissions(LEGACY_ROLE_PERMISSIONS.admin);
  }
  if (role === "coach") {
    return normalizePermissions([
      ...LEGACY_ROLE_PERMISSIONS.coach,
      ...(params.clubGrantedViewFeesToCoaches ? (["viewFees"] as const) : []),
    ]);
  }
  return normalizePermissions(LEGACY_ROLE_PERMISSIONS.player);
}

/** Équipes entraînées par chaque fiche, d'après `teams.coachIds`. */
export function coachTeamIdsByMember(teams: MigrationDoc[]): Map<string, string[]> {
  const byMember = new Map<string, string[]>();
  for (const team of teams) {
    for (const coachId of stringArray(team.data.coachIds)) {
      byMember.set(coachId, [...(byMember.get(coachId) ?? []), team.id]);
    }
  }
  for (const [memberId, teamIds] of byMember) {
    byMember.set(memberId, [...new Set(teamIds)].sort());
  }
  return byMember;
}

/** Plan de migration d'un club (aucune écriture). */
export function planClubMigration(params: {
  club: Record<string, unknown>;
  members: MigrationDoc[];
  teams: MigrationDoc[];
}): ClubMigrationPlan {
  const { club, members, teams } = params;
  const legacyAdminIds = stringArray(club.adminIds);
  const coachPermissions =
    club.coachPermissions && typeof club.coachPermissions === "object"
      ? (club.coachPermissions as Record<string, unknown>)
      : {};
  const clubGrantedViewFeesToCoaches = coachPermissions.canViewFees === true;
  const coachTeams = coachTeamIdsByMember(teams);
  const memberIds = new Set(members.map((member) => member.id));

  const memberPatches: MemberMigrationPatch[] = [];
  const adminIds: string[] = [];
  const unlinkedAdminMemberIds: string[] = [];
  const coachesWithoutTeam: string[] = [];

  for (const member of members) {
    const permissions = migratedPermissions({
      member: member.data,
      wasInAdminIds: legacyAdminIds.includes(member.id),
      clubGrantedViewFeesToCoaches,
    });
    const coachTeamIds =
      member.data.status === MEMBER_STATUS_ARCHIVED
        ? []
        : (coachTeams.get(member.id) ?? []);

    const upToDate =
      Array.isArray(member.data.permissions) &&
      sameList(stringArray(member.data.permissions), permissions) &&
      Array.isArray(member.data.coachTeamIds) &&
      sameList([...stringArray(member.data.coachTeamIds)].sort(), coachTeamIds);
    if (!upToDate) {
      memberPatches.push({ memberId: member.id, permissions, coachTeamIds });
    }

    if (grantsAdmin(permissions)) {
      if (isLinked(member.data)) adminIds.push(member.id);
      else unlinkedAdminMemberIds.push(member.id);
    }
    if (
      !Array.isArray(member.data.permissions) &&
      String(member.data.role ?? "") === "coach" &&
      coachTeamIds.length === 0
    ) {
      coachesWithoutTeam.push(member.id);
    }
  }

  adminIds.sort();
  return {
    memberPatches,
    adminIds: sameList(legacyAdminIds, adminIds) ? null : adminIds,
    report: {
      noLinkedAdmin: adminIds.length === 0,
      adminIdsWithoutMember: legacyAdminIds.filter((uid) => !memberIds.has(uid)),
      unlinkedAdminMemberIds,
      coachesWithoutTeam,
    },
  };
}

/**
 * Écart entre l'ancien index `users.clubMemberships` (`[{ clubId }]`) et
 * `users.memberClubIds`, désormais seul index des clubs : clubs déclarés
 * absents de `memberClubIds` (`missing`) et inversement (`extra`).
 * Rapport seulement : `memberClubIds` ne garde que les clubs où existe la
 * fiche du compte.
 */
export function clubIndexGap(
  clubMemberships: unknown,
  memberClubIds: unknown,
): { missing: string[]; extra: string[] } {
  const declared = new Set(
    (Array.isArray(clubMemberships) ? clubMemberships : [])
      .map((entry) =>
        entry && typeof entry === "object"
          ? String((entry as { clubId?: unknown }).clubId ?? "").trim()
          : "",
      )
      .filter(Boolean),
  );
  const indexed = new Set(stringArray(memberClubIds));
  return {
    missing: [...declared].filter((id) => !indexed.has(id)).sort(),
    extra: [...indexed].filter((id) => !declared.has(id)).sort(),
  };
}
