import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/features/fees/models/fee_payment_event.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/services/fee/fee_export.dart';
import 'package:viro_team_v2/services/fee/fee_member_operations.dart';
import 'package:viro_team_v2/services/fee/fee_paths.dart';
import 'package:viro_team_v2/services/fee/fee_read_queries.dart';
import 'package:viro_team_v2/services/fee/fee_season_operations.dart';
import 'package:viro_team_v2/services/fee/fee_tracking_bulk.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Facade cotisations : saisons, suivi membre, ledger et exports.
///
/// L'implementation est decoupee dans `lib/services/fee/` ; l'API publique
/// reste stable pour les call sites (`feeServiceProvider`, `FeeService()`).
class FeeService {
  /// Cree le service cotisations avec une base Firestore injectable.
  FeeService({FirebaseFirestore? firestore}) {
    final paths = FeePaths(firestore ?? appFirestore);
    _reads = FeeReadQueries(paths: paths);
    _seasons = FeeSeasonOperations(paths: paths);
    _members = FeeMemberOperations(paths: paths);
    _bulk = FeeTrackingBulk(paths: paths, memberOperations: _members);
    _export = const FeeExport();
  }

  late final FeeReadQueries _reads;
  late final FeeSeasonOperations _seasons;
  late final FeeMemberOperations _members;
  late final FeeTrackingBulk _bulk;
  late final FeeExport _export;

  /// Stream de la saison active du club.
  Stream<FeeSeason?> watchActiveSeason(String clubId) =>
      _reads.watchActiveSeason(clubId);

  /// Stream de la fiche cotisation d'un membre.
  Stream<MemberFee?> watchMemberFee({
    required String clubId,
    required String seasonId,
    required String memberId,
  }) => _reads.watchMemberFee(
    clubId: clubId,
    seasonId: seasonId,
    memberId: memberId,
  );

  /// Stream de toutes les fiches cotisation de la saison.
  Stream<List<MemberFee>> watchAllMemberFees({
    required String clubId,
    required String seasonId,
  }) => _reads.watchAllMemberFees(clubId: clubId, seasonId: seasonId);

  /// Historique des transactions d'une fiche cotisation (plus recent d'abord).
  Stream<List<FeePaymentEvent>> watchPaymentEvents({
    required String clubId,
    required String seasonId,
    required String memberId,
  }) => _reads.watchPaymentEvents(
    clubId: clubId,
    seasonId: seasonId,
    memberId: memberId,
  );

  /// Charge l'historique des transactions (plus recent d'abord).
  Future<List<FeePaymentEvent>> listPaymentEvents({
    required String clubId,
    required String seasonId,
    required String memberId,
    int limit = 50,
  }) => _reads.listPaymentEvents(
    clubId: clubId,
    seasonId: seasonId,
    memberId: memberId,
    limit: limit,
  );

  /// Stream de la fiche active d'un membre en joignant la saison active.
  Stream<({MemberFee? fee, FeeSeason? season})> watchActiveMemberFee({
    required String clubId,
    required String memberId,
  }) => _reads.watchActiveMemberFee(clubId: clubId, memberId: memberId);

  /// Cree une saison et desactive l'ancienne si besoin.
  Future<String> createSeason({
    required String clubId,
    required FeeSeason season,
  }) => _seasons.createSeason(clubId: clubId, season: season);

  /// Met a jour une saison existante.
  Future<void> updateSeason({
    required String clubId,
    required FeeSeason season,
  }) => _seasons.updateSeason(clubId: clubId, season: season);

  /// Ferme une saison active.
  Future<void> closeSeason({
    required String clubId,
    required String seasonId,
  }) => _seasons.closeSeason(clubId: clubId, seasonId: seasonId);

  /// Force le statut cotisation (admin). Conserve une trace ledger.
  Future<void> setMemberFeeStatus({
    required String clubId,
    required String seasonId,
    required String memberId,
    required MemberFeeStatus status,
  }) => _members.setMemberFeeStatus(
    clubId: clubId,
    seasonId: seasonId,
    memberId: memberId,
    status: status,
  );

  /// Valide un paiement hors-ligne (cheque, especes, ANCV, etc.).
  ///
  /// Credit et ledger dans une [Transaction] pour eviter un double credit
  /// concurrent. [currentFee] est conserve pour compatibilite mais ignore :
  /// la fiche est relue dans la transaction.
  Future<void> validateOfflinePayment({
    required String clubId,
    required String seasonId,
    required String memberId,
    required String offlineMethod,
    required int amountCents,
    required FeeSeason season,
    MemberFee? currentFee,
  }) => _members.validateOfflinePayment(
    clubId: clubId,
    seasonId: seasonId,
    memberId: memberId,
    offlineMethod: offlineMethod,
    amountCents: amountCents,
    season: season,
    currentFee: currentFee,
  );

  /// Pose le montant deja encaisse (absolu) et recalcule le statut.
  Future<void> adjustMemberFeePaidAmount({
    required String clubId,
    required String seasonId,
    required String memberId,
    required int amountPaidCents,
    required FeeSeason season,
    String? note,
    MemberFee? currentFee,
  }) => _members.adjustMemberFeePaidAmount(
    clubId: clubId,
    seasonId: seasonId,
    memberId: memberId,
    amountPaidCents: amountPaidCents,
    season: season,
    note: note,
    currentFee: currentFee,
  );

  /// Valide ou refuse un justificatif d'aide (Pass'Sport, ANCV, etc.).
  Future<void> setFeeAidStatus({
    required String clubId,
    required String seasonId,
    required String memberId,
    required String aidId,
    required String aidStatus,
    required FeeSeason season,
    MemberFee? currentFee,
  }) => _members.setFeeAidStatus(
    clubId: clubId,
    seasonId: seasonId,
    memberId: memberId,
    aidId: aidId,
    aidStatus: aidStatus,
    season: season,
    currentFee: currentFee,
  );

  /// Assigne un palier et recalcule le statut selon le deja paye.
  Future<void> setMemberFeeTier({
    required String clubId,
    required String seasonId,
    required String memberId,
    required String? tierId,
    required FeeSeason season,
    MemberFee? currentFee,
  }) => _members.setMemberFeeTier(
    clubId: clubId,
    seasonId: seasonId,
    memberId: memberId,
    tierId: tierId,
    season: season,
    currentFee: currentFee,
  );

  /// Met a jour la note admin d'une fiche cotisation.
  Future<void> setMemberFeeNote({
    required String clubId,
    required String seasonId,
    required String memberId,
    required String? note,
  }) => _members.setMemberFeeNote(
    clubId: clubId,
    seasonId: seasonId,
    memberId: memberId,
    note: note,
  );

  /// Compte les fiches deja assignees a un palier donne.
  Future<int> countMemberFeesWithTier({
    required String clubId,
    required String seasonId,
    required String tierId,
  }) => _members.countMemberFeesWithTier(
    clubId: clubId,
    seasonId: seasonId,
    tierId: tierId,
  );

  /// Cree les fiches manquantes pour membres + pending_members.
  Future<int> initializeMemberFees({
    required String clubId,
    required String seasonId,
    required List<ClubMember> members,
    required List<ClubTeam> teams,
    required List<ClubMember> pendingAsMembers,
    required Set<String> existingMemberIds,
    required List<FeeTier> tiers,
  }) => _bulk.initializeMemberFees(
    clubId: clubId,
    seasonId: seasonId,
    members: members,
    teams: teams,
    pendingAsMembers: pendingAsMembers,
    existingMemberIds: existingMemberIds,
    tiers: tiers,
  );

  /// Applique un statut identique a plusieurs fiches.
  Future<void> bulkSetStatus({
    required String clubId,
    required String seasonId,
    required List<String> memberIds,
    required MemberFeeStatus status,
  }) => _bulk.bulkSetStatus(
    clubId: clubId,
    seasonId: seasonId,
    memberIds: memberIds,
    status: status,
  );

  /// Assigne le meme palier a plusieurs fiches.
  Future<void> bulkSetTier({
    required String clubId,
    required String seasonId,
    required List<String> memberIds,
    required String tierId,
    required FeeSeason season,
  }) => _bulk.bulkSetTier(
    clubId: clubId,
    seasonId: seasonId,
    memberIds: memberIds,
    tierId: tierId,
    season: season,
  );

  /// Export CSV pour le tresorier.
  Future<String> exportCsv({
    required String clubId,
    required String seasonId,
    required FeeSeason season,
    required List<MemberFee> fees,
  }) => _export.exportCsv(
    clubId: clubId,
    seasonId: seasonId,
    season: season,
    fees: fees,
  );
}
