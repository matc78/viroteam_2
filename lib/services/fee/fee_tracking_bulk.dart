import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/services/fee/fee_member_operations.dart';
import 'package:viro_team_v2/services/fee/fee_paths.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/announcements/utils/announcement_filter.dart';

/// Initialisation et actions bulk du suivi cotisations.
class FeeTrackingBulk {
  /// Crée le module bulk cotisations.
  FeeTrackingBulk({
    required FeePaths paths,
    required FeeMemberOperations memberOperations,
  }) : _paths = paths,
       _memberOperations = memberOperations;

  final FeePaths _paths;
  final FeeMemberOperations _memberOperations;

  /// Crée les fiches manquantes pour membres + pending_members.
  Future<int> initializeMemberFees({
    required String clubId,
    required String seasonId,
    required List<ClubMember> members,
    required List<ClubTeam> teams,
    required List<ClubMember> pendingAsMembers,
    required Set<String> existingMemberIds,
    required List<FeeTier> tiers,
  }) async {
    final uid = _paths.currentUid();
    if (uid == null) throw StateError('Non connecté');

    final membersToCreate = <ClubMember>[
      ...members,
      ...pendingAsMembers,
    ];

    final writes = <({String id, MemberFee fee})>[];
    for (final member in membersToCreate) {
      if (existingMemberIds.contains(member.memberId)) continue;
      final suggestedTierId = _suggestTierId(
        member: member,
        teams: teams,
        tiers: tiers,
      );
      writes.add((
        id: member.memberId,
        fee: MemberFee(
          memberId: member.memberId,
          memberDisplayName: member.fullName,
          status: MemberFeeStatus.aPayer,
          tierId: suggestedTierId,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        ),
      ));
    }

    if (writes.isEmpty) return 0;

    const maxBatch = 500;
    for (var start = 0; start < writes.length; start += maxBatch) {
      final batch = _paths.db.batch();
      final end = (start + maxBatch > writes.length)
          ? writes.length
          : start + maxBatch;
      for (var index = start; index < end; index++) {
        final write = writes[index];
        final payload = write.fee.toFirestoreCreate(
          displayName: write.fee.memberDisplayName,
        );
        if (write.fee.tierId != null) {
          payload[FirestoreFields.tierId] = write.fee.tierId;
        }
        batch.set(_paths.memberFeesCol(clubId, seasonId).doc(write.id), payload);
      }
      await batch.commit();
    }
    return writes.length;
  }

  /// Applique un statut identique à plusieurs fiches.
  Future<void> bulkSetStatus({
    required String clubId,
    required String seasonId,
    required List<String> memberIds,
    required MemberFeeStatus status,
  }) async {
    const maxBatch = 500;
    for (var start = 0; start < memberIds.length; start += maxBatch) {
      final end = (start + maxBatch > memberIds.length)
          ? memberIds.length
          : start + maxBatch;
      await Future.wait(
        memberIds.sublist(start, end).map(
          (memberId) => _memberOperations.setMemberFeeStatus(
            clubId: clubId,
            seasonId: seasonId,
            memberId: memberId,
            status: status,
          ),
        ),
      );
    }
  }

  /// Assigne le même palier à plusieurs fiches.
  Future<void> bulkSetTier({
    required String clubId,
    required String seasonId,
    required List<String> memberIds,
    required String tierId,
    required FeeSeason season,
  }) async {
    const maxBatch = 500;
    for (var start = 0; start < memberIds.length; start += maxBatch) {
      final end = (start + maxBatch > memberIds.length)
          ? memberIds.length
          : start + maxBatch;
      await Future.wait(
        memberIds.sublist(start, end).map(
          (memberId) => _memberOperations.setMemberFeeTier(
            clubId: clubId,
            seasonId: seasonId,
            memberId: memberId,
            tierId: tierId,
            season: season,
          ),
        ),
      );
    }
  }

  String? _suggestTierId({
    required ClubMember member,
    required List<ClubTeam> teams,
    required List<FeeTier> tiers,
  }) {
    if (tiers.isEmpty) return null;
    final categories = memberCategoriesFromTeams(
      clubTeams: teams,
      memberTeamIds: member.teamIds,
    );
    for (final category in categories) {
      for (final tier in tiers) {
        final linkedCategory = tier.category;
        if (linkedCategory != null &&
            linkedCategory.isNotEmpty &&
            linkedCategory.toLowerCase() == category.toLowerCase()) {
          return tier.tierId;
        }
      }
    }
    for (final category in categories) {
      for (final tier in tiers) {
        if (tier.label.toLowerCase() == category.toLowerCase()) {
          return tier.tierId;
        }
      }
    }
    return null;
  }
}
