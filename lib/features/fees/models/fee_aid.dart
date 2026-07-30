import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Type d'aide / réduction appliquée sur une cotisation.
abstract final class FeeAidTypes {
  static const String passSport = 'pass_sport';
  static const String passPlus = 'pass_plus';
  static const String ancv = 'ancv';
  static const String promo = 'promo';
  static const String other = 'other';

  static const List<String> all = [
    passSport,
    passPlus,
    ancv,
    promo,
    other,
  ];

  /// Libellé FR pour l'UI.
  static String label(String type) => switch (type) {
        passSport => 'Pass\'Sport',
        passPlus => 'Pass+',
        ancv => 'Chèques ANCV',
        promo => 'Code promo',
        other => 'Autre aide',
        _ => type,
      };
}

/// Statut de justificatif d'une aide.
abstract final class FeeAidStatuses {
  static const String pendingProof = 'pending_proof';
  static const String validated = 'validated';
  static const String rejected = 'rejected';
}

/// Aide ou réduction déclarée sur une fiche cotisation.
class FeeAid {
  const FeeAid({
    required this.id,
    required this.type,
    required this.label,
    required this.amountCents,
    required this.status,
    required this.createdAt,
    this.promoCode,
    this.validatedBy,
    this.validatedAt,
  });

  final String id;
  final String type;
  final String label;
  final int amountCents;
  final String status;
  final DateTime createdAt;
  final String? promoCode;
  final String? validatedBy;
  final DateTime? validatedAt;

  bool get isPendingProof => status == FeeAidStatuses.pendingProof;
  bool get isValidated => status == FeeAidStatuses.validated;

  factory FeeAid.fromMap(Map<String, dynamic> map) {
    return FeeAid(
      id: map[FirestoreFields.id] as String? ?? '',
      type: map[FirestoreFields.type] as String? ?? FeeAidTypes.other,
      label: map[FirestoreFields.label] as String? ?? '',
      amountCents: (map[FirestoreFields.amountCents] as num?)?.toInt() ?? 0,
      status: map[FirestoreFields.status] as String? ?? FeeAidStatuses.pendingProof,
      promoCode: map[FirestoreFields.promoCode] as String?,
      validatedBy: map[FirestoreFields.validatedBy] as String?,
      validatedAt: (map[FirestoreFields.validatedAt] as Timestamp?)?.toDate(),
      createdAt:
          (map[FirestoreFields.createdAt] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        FirestoreFields.id: id,
        FirestoreFields.type: type,
        FirestoreFields.label: label,
        FirestoreFields.amountCents: amountCents,
        FirestoreFields.status: status,
        if (promoCode != null && promoCode!.isNotEmpty)
          FirestoreFields.promoCode: promoCode,
        if (validatedBy != null) FirestoreFields.validatedBy: validatedBy,
        if (validatedAt != null)
          FirestoreFields.validatedAt: Timestamp.fromDate(validatedAt!),
        FirestoreFields.createdAt: Timestamp.fromDate(createdAt),
      };

  /// Copie avec statut de validation mis à jour.
  FeeAid copyWithValidation({
    required String status,
    required String validatedBy,
    required DateTime validatedAt,
  }) {
    return FeeAid(
      id: id,
      type: type,
      label: label,
      amountCents: amountCents,
      status: status,
      createdAt: createdAt,
      promoCode: promoCode,
      validatedBy: validatedBy,
      validatedAt: validatedAt,
    );
  }
}
