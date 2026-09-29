import 'package:viro_team_v2/features/fees/models/fee_payment_event.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/services/fee/fee_paths.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Lectures Firestore cotisations (saisons, fiches et ledger).
class FeeReadQueries {
  /// Crée le module de lecture cotisations.
  FeeReadQueries({required FeePaths paths}) : _paths = paths;

  final FeePaths _paths;

  /// Stream de la saison active du club.
  Stream<FeeSeason?> watchActiveSeason(String clubId) {
    return _paths
        .feeSeasonsCol(clubId)
        .where(FirestoreFields.isActive, isEqualTo: true)
        .limit(1)
        .snapshots()
        .map((snap) {
          if (snap.docs.isEmpty) return null;
          return FeeSeason.fromFirestore(snap.docs.first);
        });
  }

  /// Stream de la fiche cotisation d'un membre.
  Stream<MemberFee?> watchMemberFee({
    required String clubId,
    required String seasonId,
    required String memberId,
  }) {
    return _paths.memberFeesCol(clubId, seasonId).doc(memberId).snapshots().map(
      (snap) {
        if (!snap.exists) return null;
        return MemberFee.fromFirestore(memberId, snap);
      },
    );
  }

  /// Stream de toutes les fiches cotisation de la saison.
  Stream<List<MemberFee>> watchAllMemberFees({
    required String clubId,
    required String seasonId,
  }) {
    return _paths.memberFeesCol(clubId, seasonId).snapshots().map(
      (snap) => snap.docs.map((doc) => MemberFee.fromFirestore(doc.id, doc)).toList(),
    );
  }

  /// Historique des transactions d'une fiche cotisation (plus récent d'abord).
  Stream<List<FeePaymentEvent>> watchPaymentEvents({
    required String clubId,
    required String seasonId,
    required String memberId,
  }) {
    return _paths
        .paymentEventsCol(clubId, seasonId, memberId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((doc) => FeePaymentEvent.fromFirestore(doc.id, doc))
              .toList(),
        );
  }

  /// Charge l'historique des transactions (plus récent d'abord).
  Future<List<FeePaymentEvent>> listPaymentEvents({
    required String clubId,
    required String seasonId,
    required String memberId,
    int limit = 50,
  }) async {
    final snap = await _paths
        .paymentEventsCol(clubId, seasonId, memberId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .limit(limit)
        .get();
    return snap.docs
        .map((doc) => FeePaymentEvent.fromFirestore(doc.id, doc))
        .toList();
  }

  /// Stream de la fiche active d'un membre en joignant la saison active.
  Stream<({MemberFee? fee, FeeSeason? season})> watchActiveMemberFee({
    required String clubId,
    required String memberId,
  }) {
    return watchActiveSeason(clubId).asyncExpand((season) {
      if (season == null) {
        return Stream.value((fee: null, season: null));
      }
      return watchMemberFee(
        clubId: clubId,
        seasonId: season.id,
        memberId: memberId,
      ).map((fee) => (fee: fee, season: season));
    });
  }
}
