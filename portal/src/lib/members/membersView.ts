import type { ClubRecord } from "@/lib/firebase/clubService";
import type { TeamOption } from "@/lib/firebase/eventService";
import { loadTeamsForClub } from "@/lib/firebase/eventService";
import {
  getActiveSeason,
  listMemberFees,
  type MemberFeeRecord,
} from "@/lib/firebase/feeService";
import {
  listClubMembers,
  isMemberInviteValid,
  memberRoleLabel,
  type ClubMemberRecord,
} from "@/lib/firebase/memberService";
import { MemberFeeStatuses, MemberRoles } from "@/lib/firebase/constants";
import { reconcileMemberTeamIds } from "@/lib/firebase/teamService";
import {
  listClubParentRows,
  type ClubParentRow,
} from "@/lib/members/parentsView";

/** Ligne membre enrichie pour le tableau portail. */
export type MemberRow = ClubMemberRecord & {
  teamNames: string[];
  /** Libellés équipes avec rôle roster (ex. « M18 filles (joueur) »). */
  teamLabels: string[];
  /** IDs d’équipes dérivés des rosters (playerIds/coachIds) + teamIds doc. */
  resolvedTeamIds: string[];
  feeStatus: string | null;
  feeStatusLabel: string;
};

/** Affectation roster d’un membre sur une équipe. */
export type MemberTeamAssignment = {
  teamId: string;
  teamName: string;
  isCoach: boolean;
  isPlayer: boolean;
};

/** Données page Membres. */
export type MembersPageData = {
  members: MemberRow[];
  teams: TeamOption[];
  seasonId: string | null;
  seasonLabel: string | null;
  parents: ClubParentRow[];
  /** True si une réparation `teamIds` a été écrite au chargement. */
  teamIdsSynced: boolean;
};

/** Libellé FR d’un statut cotisation. */
export function feeStatusLabel(status: string | null): string {
  if (!status) return "—";
  if (status === MemberFeeStatuses.aPayer) return "À payer";
  if (status === MemberFeeStatuses.partiel) return "Partiel";
  if (status === MemberFeeStatuses.paye) return "Payé";
  if (status === MemberFeeStatuses.exonere) return "Exonéré";
  return status;
}

/** Formate une affectation équipe + rôle roster pour l’UI. */
export function formatMemberTeamLabel(assignment: MemberTeamAssignment): string {
  const roles: string[] = [];
  if (assignment.isCoach) roles.push("coach");
  if (assignment.isPlayer) roles.push("joueur");
  if (roles.length === 0) return assignment.teamName;
  return `${assignment.teamName} (${roles.join(" + ")})`;
}

/** Résout les équipes d’un membre via rosters + teamIds, avec rôles roster. */
export function resolveMemberTeams(
  member: ClubMemberRecord,
  teams: TeamOption[],
): {
  teamIds: string[];
  teamNames: string[];
  teamLabels: string[];
  assignments: MemberTeamAssignment[];
} {
  const matchIds = new Set(
    [member.memberId, member.accountUid].filter(Boolean) as string[],
  );

  const assignmentsById = new Map<string, MemberTeamAssignment>();

  for (const team of teams) {
    const isPlayer = team.playerIds.some((id) => matchIds.has(id));
    const isCoach = team.coachIds.some((id) => matchIds.has(id));
    const inDoc = member.teamIds.includes(team.id);
    if (!isPlayer && !isCoach && !inDoc) continue;
    assignmentsById.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      isCoach,
      isPlayer,
    });
  }

  const assignments = [...assignmentsById.values()].sort((a, b) =>
    a.teamName.localeCompare(b.teamName, "fr"),
  );

  return {
    teamIds: assignments.map((assignment) => assignment.teamId),
    teamNames: assignments.map((assignment) => assignment.teamName),
    teamLabels: assignments.map(formatMemberTeamLabel),
    assignments,
  };
}

function feeStatusForMember(
  member: ClubMemberRecord,
  feesById: Map<string, MemberFeeRecord>,
): string | null {
  const byMemberId = feesById.get(member.memberId);
  if (byMemberId) return byMemberId.status;
  if (member.accountUid) {
    const byAccount = feesById.get(member.accountUid);
    if (byAccount) return byAccount.status;
  }
  return null;
}

/** Options de chargement page Membres (droits selon rôle). */
export type LoadMembersPageOptions = {
  /** Rôle club du viewer (`admin` / `coach` / `player`). */
  role?: string | null;
};

/**
 * Charge membres + équipes + cotisations saison active + parents.
 * List `member_fees` et reconcile `teamIds` réservés admin/coach (rules).
 */
export async function loadMembersPageData(
  club: ClubRecord,
  options: LoadMembersPageOptions = {},
): Promise<MembersPageData> {
  const role = options.role ?? null;
  const canListFees =
    role === MemberRoles.admin || role === MemberRoles.coach;
  const canReconcileTeamIds = canListFees;

  const [members, teams, season] = await Promise.all([
    listClubMembers(club.id),
    loadTeamsForClub(club.id),
    getActiveSeason(club.id),
  ]);

  const healed = canReconcileTeamIds
    ? await reconcileMemberTeamIds(club.id, {
        members: members.map((member) => ({
          memberId: member.memberId,
          accountUid: member.accountUid,
          teamIds: member.teamIds,
        })),
        teams,
      })
    : false;

  // Recharge après réparation pour aligner rosters normalisés + teamIds.
  const [membersForRows, teamsForRows] = healed
    ? await Promise.all([listClubMembers(club.id), loadTeamsForClub(club.id)])
    : [members, teams];

  const [fees, parentsResult] = await Promise.all([
    season && canListFees
      ? listMemberFees(club.id, season.id)
      : Promise.resolve([]),
    listClubParentRows(club.id, membersForRows).catch(
      () => [] as ClubParentRow[],
    ),
  ]);
  const feesById = new Map(fees.map((fee) => [fee.id, fee]));

  const rows: MemberRow[] = membersForRows.map((member) => {
    const resolved = resolveMemberTeams(member, teamsForRows);
    const feeStatus = feeStatusForMember(member, feesById);
    return {
      ...member,
      teamNames: resolved.teamNames,
      teamLabels: resolved.teamLabels,
      resolvedTeamIds: resolved.teamIds,
      feeStatus,
      feeStatusLabel: feeStatusLabel(feeStatus),
    };
  });

  return {
    members: rows,
    teams: teamsForRows,
    seasonId: season?.id ?? null,
    seasonLabel: season?.seasonLabel ?? null,
    parents: parentsResult,
    teamIdsSynced: healed,
  };
}

/** Filtres UI tableau membres. */
export type MembersFilters = {
  search: string;
  role: "all" | typeof MemberRoles.admin | typeof MemberRoles.coach | typeof MemberRoles.player;
  teamId: string;
  registration: "all" | "registered" | "pending";
  feeStatus: "all" | string;
};

/** Applique les filtres sur les lignes membres. */
export function filterMemberRows(
  rows: MemberRow[],
  filters: MembersFilters,
): MemberRow[] {
  const search = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.role !== "all" && row.role !== filters.role) return false;
    if (
      filters.teamId &&
      filters.teamId !== "all" &&
      !row.resolvedTeamIds.includes(filters.teamId)
    ) {
      return false;
    }
    if (filters.registration === "registered" && !row.hasLinkedAccount) {
      return false;
    }
    if (filters.registration === "pending" && row.hasLinkedAccount) {
      return false;
    }
    if (
      filters.feeStatus !== "all" &&
      (row.feeStatus ?? "") !== filters.feeStatus
    ) {
      return false;
    }
    if (!search) return true;
    const haystack = [
      row.displayName,
      row.firstName,
      row.lastName,
      row.email ?? "",
      row.license,
      row.pendingInviteCode ?? "",
      memberRoleLabel(row.role),
      ...row.teamNames,
      ...row.teamLabels,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
}

/** Buckets d’activation du roster (comptes liés vs invites). */
export type ActivationBucket =
  | "linked"
  | "pendingInvite"
  | "withEmailNotLinked"
  | "noEmail";

/** Compteurs d’activation pour l’onglet Activation. */
export type ActivationStats = {
  linked: number;
  pendingInvite: number;
  withEmailNotLinked: number;
  noEmail: number;
  total: number;
};

/** True si le membre a un e-mail exploitable pour une invitation. */
export function memberHasInviteEmail(member: {
  email?: string | null;
}): boolean {
  return Boolean(member.email?.trim());
}

/** True si non lié + e-mail (éligible à sendMemberInvites / ensurePendingInvite). */
export function isMemberInviteEmailEligible(member: {
  hasLinkedAccount: boolean;
  email?: string | null;
}): boolean {
  return !member.hasLinkedAccount && memberHasInviteEmail(member);
}

/** True si invite pending encore valide (code + expiration). */
export function memberHasValidPendingInvite(member: {
  pendingInviteCode?: string | null;
  pendingInviteExpiresAt?: Date | string | null;
}): boolean {
  return isMemberInviteValid({
    pendingInviteCode: member.pendingInviteCode ?? null,
    pendingInviteExpiresAt: member.pendingInviteExpiresAt ?? null,
  });
}

/**
 * True si non lié + e-mail + pas d’invite valide (premier envoi ou code expiré).
 * Exclut volontairement « Invite en cours » pour éviter les envois Brevo en double.
 */
export function isMemberNeedingFirstInvite(member: {
  hasLinkedAccount: boolean;
  email?: string | null;
  pendingInviteCode?: string | null;
  pendingInviteExpiresAt?: Date | string | null;
}): boolean {
  return (
    isMemberInviteEmailEligible(member) && !memberHasValidPendingInvite(member)
  );
}

/**
 * Calcule les stats d’activation à partir des lignes membres déjà chargées.
 * Les buckets `withEmailNotLinked` et `pendingInvite` sont disjoints
 * (somme des 4 buckets = total).
 */
export function computeActivationStats(
  rows: Array<{
    hasLinkedAccount: boolean;
    email?: string | null;
    pendingInviteCode?: string | null;
    pendingInviteExpiresAt?: Date | string | null;
  }>,
): ActivationStats {
  let linked = 0;
  let pendingInvite = 0;
  let withEmailNotLinked = 0;
  let noEmail = 0;

  for (const row of rows) {
    if (row.hasLinkedAccount) {
      linked += 1;
      continue;
    }
    if (!memberHasInviteEmail(row)) {
      noEmail += 1;
      continue;
    }
    if (memberHasValidPendingInvite(row)) {
      pendingInvite += 1;
    } else {
      withEmailNotLinked += 1;
    }
  }

  return {
    linked,
    pendingInvite,
    withEmailNotLinked,
    noEmail,
    total: rows.length,
  };
}

/** Filtre les lignes selon le bucket d’activation sélectionné. */
export function filterActivationRows<
  T extends {
    hasLinkedAccount: boolean;
    email?: string | null;
    pendingInviteCode?: string | null;
    pendingInviteExpiresAt?: Date | string | null;
  },
>(rows: T[], bucket: ActivationBucket): T[] {
  return rows.filter((row) => {
    if (bucket === "linked") return row.hasLinkedAccount;
    if (bucket === "noEmail") {
      return !row.hasLinkedAccount && !memberHasInviteEmail(row);
    }
    if (bucket === "pendingInvite") {
      return (
        !row.hasLinkedAccount &&
        memberHasInviteEmail(row) &&
        memberHasValidPendingInvite(row)
      );
    }
    // withEmailNotLinked : e-mail + pas d’invite valide (disjoint de pending).
    return isMemberNeedingFirstInvite(row);
  });
}

