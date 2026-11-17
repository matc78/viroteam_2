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
  /** Le club n'a aucune fiche active (vide ou tout archivé) : il est supprimé. */
  deleteClub: boolean;
  /** Fiches dont `permissions` ou `coachTeamIds` doit être écrit. */
  memberPatches: MemberMigrationPatch[];
  /** Nouvel index `adminIds`, ou `null` s'il est déjà à jour. */
  adminIds: string[] | null;
  report: {
    /**
     * Le club reste sans admin lié à un compte après promotion (aucune fiche
     * liée : l'admin, promu ou existant, agira à la liaison de son compte).
     */
    noLinkedAdmin: boolean;
    /**
     * Fiche promue admin faute d'admin lié : le premier membre arrivé, lié à
     * un compte de préférence. `null` si aucune promotion.
     */
    promotedAdminMemberId: string | null;
    /** Uids de l'ancien `adminIds` sans fiche `members/{uid}`. */
    adminIdsWithoutMember: string[];
    /** Fiches admin non liées à un compte (hors index, ne peuvent pas agir). */
    unlinkedAdminMemberIds: string[];
    /**
     * Anciens coachs qui n'entraînent aucune équipe : passés membres (aucun
     * droit), l'admin leur réattribue des droits ou une équipe.
     */
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

/** Date d'arrivée (`joinedAt`, sinon `createdAt`) en ms ; inconnue en dernier. */
function arrivalMillis(member: Record<string, unknown>): number {
  for (const value of [member.joinedAt, member.createdAt]) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
      return (value as { toMillis: () => number }).toMillis();
    }
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Premier membre arrivé parmi les fiches actives, celles liées à un compte
 * d'abord (seules à pouvoir administrer tout de suite). `null` si aucune.
 */
export function firstMemberToPromote(members: MigrationDoc[]): MigrationDoc | null {
  const active = members.filter(
    (member) => member.data.status !== MEMBER_STATUS_ARCHIVED,
  );
  const ordered = [...active].sort(
    (a, b) =>
      Number(isLinked(b.data)) - Number(isLinked(a.data)) ||
      arrivalMillis(a.data) - arrivalMillis(b.data) ||
      a.id.localeCompare(b.id),
  );
  return ordered[0] ?? null;
}

/**
 * Droits d'une fiche après migration. Une fiche qui porte déjà `permissions`
 * est conservée telle quelle (migration relançable) ; sinon l'ancien rôle est
 * converti par son modèle. `wasInAdminIds` : l'ancien `adminIds` donnait le
 * droit admin au même titre que `role == admin`. `coachesATeam` (vrai par
 * défaut) : un ancien coach sans équipe devient simple membre (aucun droit).
 */
export function migratedPermissions(params: {
  member: Record<string, unknown>;
  wasInAdminIds: boolean;
  clubGrantedViewFeesToCoaches: boolean;
  coachesATeam?: boolean;
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
  if (role === "coach" && params.coachesATeam !== false) {
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

  // Aucune fiche active (seulement des fiches archivées, ex. comptes
  // supprimés) : personne ne peut plus rien faire du club.
  if (members.every((member) => member.data.status === MEMBER_STATUS_ARCHIVED)) {
    return {
      deleteClub: true,
      memberPatches: [],
      adminIds: null,
      report: {
        noLinkedAdmin: true,
        promotedAdminMemberId: null,
        adminIdsWithoutMember: [...legacyAdminIds],
        unlinkedAdminMemberIds: [],
        coachesWithoutTeam: [],
      },
    };
  }

  const coachesWithoutTeam: string[] = [];
  const targets = members.map((member) => {
    const coachTeamIds =
      member.data.status === MEMBER_STATUS_ARCHIVED
        ? []
        : (coachTeams.get(member.id) ?? []);
    const legacyCoachWithoutTeam =
      !Array.isArray(member.data.permissions) &&
      member.data.status !== MEMBER_STATUS_ARCHIVED &&
      String(member.data.role ?? "") === "coach" &&
      coachTeamIds.length === 0;
    const permissions = migratedPermissions({
      member: member.data,
      wasInAdminIds: legacyAdminIds.includes(member.id),
      clubGrantedViewFeesToCoaches,
      coachesATeam: !legacyCoachWithoutTeam,
    });
    if (legacyCoachWithoutTeam && !grantsAdmin(permissions)) {
      coachesWithoutTeam.push(member.id);
    }
    return { member, permissions, coachTeamIds };
  });

  // Toujours au moins un admin lié : sinon le premier membre arrivé (lié de
  // préférence) est promu. S'il n'y a aucune fiche liée, un admin en attente
  // de liaison suffit ; à défaut, la première fiche est promue.
  const hasLinkedAdmin = targets.some(
    (target) => grantsAdmin(target.permissions) && isLinked(target.member.data),
  );
  const hasAnyAdmin = targets.some((target) => grantsAdmin(target.permissions));
  let promotedAdminMemberId: string | null = null;
  if (!hasLinkedAdmin) {
    const candidate = firstMemberToPromote(members);
    const target = candidate
      ? targets.find((item) => item.member.id === candidate.id)
      : undefined;
    if (candidate && target && (isLinked(candidate.data) || !hasAnyAdmin)) {
      promotedAdminMemberId = candidate.id;
      target.permissions = normalizePermissions([
        ...target.permissions,
        PERMISSION_ADMIN,
      ]);
      const index = coachesWithoutTeam.indexOf(candidate.id);
      if (index >= 0) coachesWithoutTeam.splice(index, 1);
    }
  }

  const memberPatches: MemberMigrationPatch[] = [];
  const adminIds: string[] = [];
  const unlinkedAdminMemberIds: string[] = [];
  for (const { member, permissions, coachTeamIds } of targets) {
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
  }

  adminIds.sort();
  return {
    deleteClub: false,
    memberPatches,
    adminIds: sameList(legacyAdminIds, adminIds) ? null : adminIds,
    report: {
      noLinkedAdmin: adminIds.length === 0,
      promotedAdminMemberId,
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
