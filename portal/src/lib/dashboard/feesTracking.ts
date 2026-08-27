import type { ClubRecord } from "@/lib/firebase/clubService";
import {
  FeeAidStatuses,
  MemberFeeStatuses,
} from "@/lib/firebase/constants";
import {
  loadTeamsForClub,
  type TeamOption,
} from "@/lib/firebase/eventService";
import {
  FeeSeasonRecord,
  getActiveSeason,
  listMemberFees,
  remainingCents,
  type FeeAidRecord,
  type FeeTier,
  type MemberFeeRecord,
} from "@/lib/firebase/feeService";
import { listClubMembers } from "@/lib/firebase/memberService";
import {
  feeStatusLabel,
  resolveMemberTeams,
} from "@/lib/members/membersView";

/** Ligne suivi cotisation (une action claire par membre). */
export type FeeTrackingRow = {
  memberId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  /** E-mail membre (snapshot ou compte lié), pour relance mailto. */
  email: string | null;
  fee: MemberFeeRecord | null;
  tierId: string | null;
  status: string | null;
  feeStatusLabel: string;
  remainingCents: number;
  pendingAids: FeeAidRecord[];
  /** True si une action admin est encore attendue. */
  needsAction: boolean;
  /** IDs d’équipes résolus (rosters + teamIds). */
  resolvedTeamIds: string[];
  teamNames: string[];
  /** Catégories sport des équipes du membre. */
  sportCategories: string[];
};

/** Données onglet suivi cotisations. */
export type FeesTrackingData = {
  season: FeeSeasonRecord;
  rows: FeeTrackingRow[];
  teams: TeamOption[];
  /** Catégories sport distinctes (triées). */
  sportCategories: string[];
  /** Compteurs pour le résumé en tête. */
  counts: {
    needsAction: number;
    remainingDue: number;
    pendingAids: number;
  };
};

function feeForMember(
  memberId: string,
  accountUid: string | null,
  feesById: Map<string, MemberFeeRecord>,
): MemberFeeRecord | null {
  const byMemberId = feesById.get(memberId);
  if (byMemberId) return byMemberId;
  if (accountUid) {
    const byAccount = feesById.get(accountUid);
    if (byAccount) return byAccount;
  }
  return null;
}

/** Indique si le membre demande encore une action bureau. */
export function rowNeedsAction(
  fee: MemberFeeRecord | null,
  remaining: number,
  pendingAids: FeeAidRecord[],
): boolean {
  if (pendingAids.length > 0) return true;
  if (!fee) return true;
  if (fee.status === MemberFeeStatuses.exonere) return false;
  if (fee.status === MemberFeeStatuses.paye && remaining <= 0) return false;
  if (!fee.tierId) return true;
  if (remaining > 0) return true;
  return false;
}

/**
 * Suggère un palier selon la catégorie sport du membre :
 * 1) `tier.category` associée, 2) sinon libellé = catégorie.
 */
export function suggestTierIdForCategories(
  sportCategories: string[],
  tiers: FeeTier[],
): string | null {
  if (tiers.length === 0 || sportCategories.length === 0) return null;
  for (const category of sportCategories) {
    const needle = category.toLowerCase();
    const byLinked = tiers.find(
      (tier) => tier.category?.toLowerCase() === needle,
    );
    if (byLinked) return byLinked.tierId;
  }
  for (const category of sportCategories) {
    const needle = category.toLowerCase();
    const byLabel = tiers.find((tier) => tier.label.toLowerCase() === needle);
    if (byLabel) return byLabel.tierId;
  }
  return null;
}

/** Charge tous les membres + fiches cotisation pour le suivi simplifié. */
export async function loadFeesTrackingData(
  club: ClubRecord,
): Promise<FeesTrackingData | null> {
  const season = await getActiveSeason(club.id);
  if (!season) return null;

  const [members, fees, teams] = await Promise.all([
    listClubMembers(club.id),
    listMemberFees(club.id, season.id),
    loadTeamsForClub(club.id),
  ]);
  const feesById = new Map(fees.map((fee) => [fee.id, fee]));

  const rows: FeeTrackingRow[] = members.map((member) => {
    const fee = feeForMember(member.memberId, member.accountUid, feesById);
    const pendingAids =
      fee?.aids.filter((aid) => aid.status === FeeAidStatuses.pendingProof) ??
      [];
    const remaining = fee ? remainingCents(fee, season) : 0;
    const status = fee?.status ?? null;
    const resolved = resolveMemberTeams(member, teams);
    const memberTeams = teams.filter((team) =>
      resolved.teamIds.includes(team.id),
    );
    const sportCategories = [
      ...new Set(
        memberTeams
          .map((team) => team.category.trim())
          .filter((category) => category.length > 0),
      ),
    ].sort((a, b) => a.localeCompare(b, "fr"));

    return {
      memberId: member.memberId,
      displayName: fee?.memberDisplayName || member.displayName,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      fee,
      tierId: fee?.tierId ?? null,
      status,
      feeStatusLabel: feeStatusLabel(status),
      remainingCents: remaining,
      pendingAids,
      needsAction: rowNeedsAction(fee, remaining, pendingAids),
      resolvedTeamIds: resolved.teamIds,
      teamNames: resolved.teamNames,
      sportCategories,
    };
  });

  rows.sort((a, b) => {
    if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
    const last = a.lastName.localeCompare(b.lastName, "fr");
    if (last !== 0) return last;
    return a.firstName.localeCompare(b.firstName, "fr");
  });

  let remainingDue = 0;
  let pendingAidsCount = 0;
  let needsAction = 0;
  for (const row of rows) {
    if (row.needsAction) needsAction += 1;
    if (row.remainingCents > 0) remainingDue += 1;
    pendingAidsCount += row.pendingAids.length;
  }

  const sportCategories = [
    ...new Set(
      teams
        .map((team) => team.category.trim())
        .filter((category) => category.length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  return {
    season,
    rows,
    teams,
    sportCategories,
    counts: {
      needsAction,
      remainingDue,
      pendingAids: pendingAidsCount,
    },
  };
}
