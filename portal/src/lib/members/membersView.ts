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
  memberRoleLabel,
  type ClubMemberRecord,
} from "@/lib/firebase/memberService";
import { MemberFeeStatuses, MemberRoles } from "@/lib/firebase/constants";

/** Ligne membre enrichie pour le tableau portail. */
export type MemberRow = ClubMemberRecord & {
  teamNames: string[];
  /** IDs d’équipes dérivés des rosters (playerIds/coachIds) + teamIds doc. */
  resolvedTeamIds: string[];
  feeStatus: string | null;
  feeStatusLabel: string;
};

/** Données page Membres. */
export type MembersPageData = {
  members: MemberRow[];
  teams: TeamOption[];
  seasonLabel: string | null;
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

/** Résout les équipes d’un membre via rosters + teamIds. */
export function resolveMemberTeams(
  member: ClubMemberRecord,
  teams: TeamOption[],
): { teamIds: string[]; teamNames: string[] } {
  const matchIds = new Set(
    [member.memberId, member.accountUid].filter(Boolean) as string[],
  );
  const fromRosters = teams.filter(
    (team) =>
      team.playerIds.some((id) => matchIds.has(id)) ||
      team.coachIds.some((id) => matchIds.has(id)),
  );
  const fromDoc = teams.filter((team) => member.teamIds.includes(team.id));
  const merged = new Map<string, TeamOption>();
  for (const team of [...fromRosters, ...fromDoc]) {
    merged.set(team.id, team);
  }
  const list = [...merged.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );
  return {
    teamIds: list.map((team) => team.id),
    teamNames: list.map((team) => team.name),
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

/** Charge membres + équipes + cotisations saison active. */
export async function loadMembersPageData(
  club: ClubRecord,
): Promise<MembersPageData> {
  const [members, teams, season] = await Promise.all([
    listClubMembers(club.id),
    loadTeamsForClub(club.id),
    getActiveSeason(club.id),
  ]);

  const fees = season
    ? await listMemberFees(club.id, season.id)
    : [];
  const feesById = new Map(fees.map((fee) => [fee.id, fee]));

  const rows: MemberRow[] = members.map((member) => {
    const resolved = resolveMemberTeams(member, teams);
    const feeStatus = feeStatusForMember(member, feesById);
    return {
      ...member,
      teamNames: resolved.teamNames,
      resolvedTeamIds: resolved.teamIds,
      feeStatus,
      feeStatusLabel: feeStatusLabel(feeStatus),
    };
  });

  return {
    members: rows,
    teams,
    seasonLabel: season?.seasonLabel ?? null,
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
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
}
