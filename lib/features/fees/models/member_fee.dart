import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/fees/models/fee_aid.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';

enum MemberFeeStatus { aPayer, partiel, paye, exonere }

enum MemberFeeDisplayStatus { aPayer, echeanceAujourdhui, enRetard, partiel, paye, exonere }

extension MemberFeeStatusX on MemberFeeStatus {
  String get firestoreValue => switch (this) {
        MemberFeeStatus.aPayer => MemberFeeStatuses.aPayer,
        MemberFeeStatus.partiel => MemberFeeStatuses.partiel,
        MemberFeeStatus.paye => MemberFeeStatuses.paye,
        MemberFeeStatus.exonere => MemberFeeStatuses.exonere,
      };

  static MemberFeeStatus fromFirestore(String? value) {
    switch (value) {
      case MemberFeeStatuses.paye:
        return MemberFeeStatus.paye;
      case MemberFeeStatuses.exonere:
        return MemberFeeStatus.exonere;
      case MemberFeeStatuses.partiel:
        return MemberFeeStatus.partiel;
      case MemberFeeStatuses.aPayer:
      default:
        return MemberFeeStatus.aPayer;
    }
  }

  String get label => switch (this) {
        MemberFeeStatus.aPayer => 'À payer',
        MemberFeeStatus.partiel => 'Partiel',
        MemberFeeStatus.paye => 'Payé',
        MemberFeeStatus.exonere => 'Exonéré',
      };
}

extension MemberFeeDisplayStatusX on MemberFeeDisplayStatus {
  String get label => switch (this) {
        MemberFeeDisplayStatus.aPayer => 'À payer',
        MemberFeeDisplayStatus.echeanceAujourdhui => 'Échéance aujourd\'hui',
        MemberFeeDisplayStatus.enRetard => 'En retard',
        MemberFeeDisplayStatus.partiel => 'Partiel',
        MemberFeeDisplayStatus.paye => 'Payé',
        MemberFeeDisplayStatus.exonere => 'Exonéré',
      };
}

/// Canal de règlement d'une cotisation.
abstract final class FeePaidVia {
  static const String manual = 'manual';
  static const String offline = 'offline';
  static const String inApp = 'in_app';
  static const String helloasso = 'helloasso';
}

/// Prestataire de paiement en ligne.
abstract final class FeePaymentProviders {
  static const String helloasso = 'helloasso';
}

class MemberFee {
  const MemberFee({
    required this.memberId,
    required this.memberDisplayName,
    required this.status,
    this.tierId,
    this.notesAdmin,
    this.paidAt,
    this.markedBy,
    this.paidVia,
    this.paymentProvider,
    this.externalPaymentId,
    this.externalOrderId,
    this.checkoutIntentId,
    this.amountPaidCents = 0,
    this.aids = const [],
    this.installmentCount,
    this.offlineMethod,
    this.receiptUrl,
    required this.createdAt,
    required this.updatedAt,
  });

  final String memberId;
  final String memberDisplayName;
  final MemberFeeStatus status;
  final String? tierId;
  final String? notesAdmin;
  final DateTime? paidAt;
  final String? markedBy;
  final String? paidVia;
  final String? paymentProvider;
  final String? externalPaymentId;
  final String? externalOrderId;
  final String? checkoutIntentId;
  final int amountPaidCents;
  final List<FeeAid> aids;
  final int? installmentCount;
  final String? offlineMethod;
  final String? receiptUrl;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory MemberFee.fromFirestore(
    String memberId,
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final d = doc.data() ?? {};
    final aidsRaw = d[FirestoreFields.aids] as List<dynamic>? ?? [];
    return MemberFee(
      memberId: memberId,
      memberDisplayName:
          d[FirestoreFields.memberDisplayName] as String? ?? '',
      status: MemberFeeStatusX.fromFirestore(
        d[FirestoreFields.feeStatus] as String?,
      ),
      tierId: d[FirestoreFields.tierId] as String?,
      notesAdmin: d[FirestoreFields.notesAdmin] as String?,
      paidAt: (d[FirestoreFields.paidAt] as Timestamp?)?.toDate(),
      markedBy: d[FirestoreFields.markedBy] as String?,
      paidVia: d[FirestoreFields.paidVia] as String?,
      paymentProvider: d[FirestoreFields.paymentProvider] as String?,
      externalPaymentId: d[FirestoreFields.externalPaymentId] as String?,
      externalOrderId: d[FirestoreFields.externalOrderId] as String?,
      checkoutIntentId: d[FirestoreFields.checkoutIntentId] as String?,
      amountPaidCents: (d[FirestoreFields.amountPaidCents] as num?)?.toInt() ?? 0,
      aids: aidsRaw
          .whereType<Map<String, dynamic>>()
          .map(FeeAid.fromMap)
          .toList(),
      installmentCount: (d[FirestoreFields.installmentCount] as num?)?.toInt(),
      offlineMethod: d[FirestoreFields.offlineMethod] as String?,
      receiptUrl: d[FirestoreFields.receiptUrl] as String?,
      createdAt:
          (d[FirestoreFields.createdAt] as Timestamp?)?.toDate() ??
              DateTime.now(),
      updatedAt:
          (d[FirestoreFields.updatedAt] as Timestamp?)?.toDate() ??
              DateTime.now(),
    );
  }

  /// Montant catalogue (palier), hors aides.
  int amountDueCents(FeeSeason? season) {
    if (status == MemberFeeStatus.exonere) return 0;
    if (season == null || tierId == null) return 0;
    for (final t in season.tiers) {
      if (t.tierId == tierId) return t.amountCents;
    }
    return 0;
  }

  /// Somme des aides validées par le trésorier.
  int get validatedAidsCents {
    var total = 0;
    for (final aid in aids) {
      if (aid.isValidated) total += aid.amountCents;
    }
    return total;
  }

  /// Somme des aides encore en attente de justificatif.
  int get pendingAidsCents {
    var total = 0;
    for (final aid in aids) {
      if (aid.isPendingProof) total += aid.amountCents;
    }
    return total;
  }

  /// Montant déjà couvert (CB/hors-ligne + aides validées).
  int coveredCents(FeeSeason? season) =>
      amountPaidCents + validatedAidsCents;

  /// Reste à encaisser / justifier (catalogue − couvert).
  int remainingCents(FeeSeason? season) {
    final due = amountDueCents(season);
    final remaining = due - coveredCents(season);
    return remaining < 0 ? 0 : remaining;
  }

  /// Montant CB à demander maintenant (reste − aides pending déclarées).
  int cardCheckoutCents(FeeSeason? season) {
    final afterPending = remainingCents(season) - pendingAidsCents;
    return afterPending < 0 ? 0 : afterPending;
  }

  FeeTier? resolveTier(FeeSeason? season) {
    if (season == null || tierId == null) return null;
    for (final t in season.tiers) {
      if (t.tierId == tierId) return t;
    }
    return null;
  }

  MemberFeeDisplayStatus displayStatus(DateTime? deadline, [DateTime? clock]) {
    if (status == MemberFeeStatus.paye) return MemberFeeDisplayStatus.paye;
    if (status == MemberFeeStatus.exonere) {
      return MemberFeeDisplayStatus.exonere;
    }
    if (deadline != null && isDeadlineToday(deadline, clock)) {
      if (status == MemberFeeStatus.partiel) {
        return MemberFeeDisplayStatus.echeanceAujourdhui;
      }
      if (status == MemberFeeStatus.aPayer) {
        return MemberFeeDisplayStatus.echeanceAujourdhui;
      }
    }
    if (status == MemberFeeStatus.partiel) {
      return MemberFeeDisplayStatus.partiel;
    }
    if (deadline != null && _isDeadlineElapsed(deadline, clock)) {
      return MemberFeeDisplayStatus.enRetard;
    }
    return MemberFeeDisplayStatus.aPayer;
  }

  /// Vrai si [clock] tombe le jour calendaire de l'échéance.
  static bool isDeadlineToday(DateTime deadline, [DateTime? clock]) {
    final now = clock ?? DateTime.now();
    final end = DateTime(deadline.year, deadline.month, deadline.day);
    final today = DateTime(now.year, now.month, now.day);
    return today.isAtSameMomentAs(end);
  }

  static bool _isDeadlineElapsed(DateTime deadline, DateTime? clock) {
    final now = clock ?? DateTime.now();
    final end = DateTime(deadline.year, deadline.month, deadline.day);
    final today = DateTime(now.year, now.month, now.day);
    return today.isAfter(end);
  }

  Map<String, dynamic> toFirestoreCreate({
    required String displayName,
  }) {
    return {
      FirestoreFields.memberId: memberId,
      FirestoreFields.memberDisplayName: displayName,
      FirestoreFields.feeStatus: status.firestoreValue,
      FirestoreFields.amountPaidCents: 0,
      FirestoreFields.aids: <Map<String, dynamic>>[],
      if (tierId != null && tierId!.isNotEmpty) FirestoreFields.tierId: tierId,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    };
  }
}
