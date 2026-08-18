import type { ClubRecord } from "@/lib/firebase/clubService";
import {
  FeeAidStatuses,
  MemberFeeStatuses,
} from "@/lib/firebase/constants";
import {
  FeeSeasonRecord,
  getActiveSeason,
  listMemberFees,
  type MemberFeeRecord,
} from "@/lib/firebase/feeService";
import { listClubMembers, type ClubMemberRecord } from "@/lib/firebase/memberService";
import { feeStatusLabel } from "@/lib/members/membersView";

/** Ligne suivi cotisation pour le portail. */
export type FeeTrackingRow = {
  memberId: string;
  displayName: string;
  fee: MemberFeeRecord;
  feeStatusLabel: string;
  hasPendingAids: boolean;
};

/** Données suivi cotisations. */
export type FeesTrackingData = {
  season: FeeSeasonRecord;
  rows: FeeTrackingRow[];
};

function feeForMember(
  member: ClubMemberRecord,
  feesById: Map<string, MemberFeeRecord>,
): MemberFeeRecord | null {
  const byMemberId = feesById.get(member.memberId);
  if (byMemberId) return byMemberId;
  if (member.accountUid) {
    const byAccount = feesById.get(member.accountUid);
    if (byAccount) return byAccount;
  }
  return null;
}

function needsTracking(fee: MemberFeeRecord): boolean {
  if (fee.status === MemberFeeStatuses.aPayer) return true;
  if (fee.status === MemberFeeStatuses.partiel) return true;
  return fee.aids.some((aid) => aid.status === FeeAidStatuses.pendingProof);
}

/** Charge les fiches cotisation à suivre pour un club. */
export async function loadFeesTrackingData(
  club: ClubRecord,
): Promise<FeesTrackingData | null> {
  const season = await getActiveSeason(club.id);
  if (!season) return null;

  const [members, fees] = await Promise.all([
    listClubMembers(club.id),
    listMemberFees(club.id, season.id),
  ]);
  const feesById = new Map(fees.map((fee) => [fee.id, fee]));

  const rows: FeeTrackingRow[] = [];
  for (const member of members) {
    const fee = feeForMember(member, feesById);
    if (!fee || !needsTracking(fee)) continue;
    rows.push({
      memberId: fee.id,
      displayName: fee.memberDisplayName || member.displayName,
      fee,
      feeStatusLabel: feeStatusLabel(fee.status),
      hasPendingAids: fee.aids.some(
        (aid) => aid.status === FeeAidStatuses.pendingProof,
      ),
    });
  }

  rows.sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
  return { season, rows };
}
