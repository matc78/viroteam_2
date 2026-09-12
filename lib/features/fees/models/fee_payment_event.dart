import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Types d'événements du ledger cotisations (`payment_events`).
abstract final class FeePaymentEventTypes {
  static const String offlineCredit = 'offline_credit';
  static const String cardCredit = 'card_credit';
  static const String adjustAbsolute = 'adjust_absolute';
  static const String aidValidated = 'aid_validated';
  static const String aidRejected = 'aid_rejected';
  static const String markedPaid = 'marked_paid';
  static const String exempted = 'exempted';
  static const String unexempted = 'unexempted';
}

/// Une ligne d'historique de paiement / correction cotisation.
class FeePaymentEvent {
  const FeePaymentEvent({
    required this.id,
    required this.type,
    required this.deltaCents,
    required this.amountPaidCentsBefore,
    required this.amountPaidCentsAfter,
    required this.statusAfter,
    required this.actorUid,
    required this.createdAt,
    this.offlineMethod,
    this.paidVia,
    this.paymentProvider,
    this.externalPaymentId,
    this.sessionId,
    this.aidId,
    this.aidLabel,
    this.aidAmountCents,
    this.note,
  });

  final String id;
  final String type;
  final int deltaCents;
  final int amountPaidCentsBefore;
  final int amountPaidCentsAfter;
  final String statusAfter;
  final String actorUid;
  final DateTime createdAt;
  final String? offlineMethod;
  final String? paidVia;
  final String? paymentProvider;
  final String? externalPaymentId;
  final String? sessionId;
  final String? aidId;
  final String? aidLabel;
  final int? aidAmountCents;
  final String? note;

  /// Construit depuis un document Firestore.
  factory FeePaymentEvent.fromFirestore(
    String id,
    DocumentSnapshot<Map<String, dynamic>> snap,
  ) {
    final data = snap.data() ?? const <String, dynamic>{};
    return FeePaymentEvent.fromMap(id, data);
  }

  /// Construit depuis une map Firestore.
  factory FeePaymentEvent.fromMap(String id, Map<String, dynamic> data) {
    final createdRaw = data[FirestoreFields.createdAt];
    final createdAt = createdRaw is Timestamp
        ? createdRaw.toDate()
        : DateTime.fromMillisecondsSinceEpoch(0);

    return FeePaymentEvent(
      id: id,
      type: data[FirestoreFields.type] as String? ?? '',
      deltaCents: (data[FirestoreFields.deltaCents] as num?)?.toInt() ?? 0,
      amountPaidCentsBefore:
          (data[FirestoreFields.amountPaidCentsBefore] as num?)?.toInt() ?? 0,
      amountPaidCentsAfter:
          (data[FirestoreFields.amountPaidCentsAfter] as num?)?.toInt() ?? 0,
      statusAfter: data[FirestoreFields.statusAfter] as String? ?? '',
      actorUid: data[FirestoreFields.actorUid] as String? ?? '',
      createdAt: createdAt,
      offlineMethod: data[FirestoreFields.offlineMethod] as String?,
      paidVia: data[FirestoreFields.paidVia] as String?,
      paymentProvider: data[FirestoreFields.paymentProvider] as String?,
      externalPaymentId: data[FirestoreFields.externalPaymentId] as String?,
      sessionId: data[FirestoreFields.sessionId] as String?,
      aidId: data[FirestoreFields.aidId] as String?,
      aidLabel: data[FirestoreFields.aidLabel] as String?,
      aidAmountCents: (data[FirestoreFields.aidAmountCents] as num?)?.toInt(),
      note: data[FirestoreFields.note] as String?,
    );
  }

  /// Titre court pour l'UI (voix AppCopy).
  String get title => AppCopy.fees.paymentEventTitle(type);

  /// Sous-titre détail (montant, moyen, aide…).
  String get detail {
    final parts = <String>[];
    switch (type) {
      case FeePaymentEventTypes.offlineCredit:
        if (deltaCents != 0) {
          parts.add(AppCopy.fees.formatEventDeltaCents(deltaCents));
        }
        if (offlineMethod != null && offlineMethod!.isNotEmpty) {
          parts.add(AppCopy.fees.paymentMethod(offlineMethod!));
        }
      case FeePaymentEventTypes.cardCredit:
        if (deltaCents != 0) {
          parts.add(AppCopy.fees.formatEventDeltaCents(deltaCents));
        }
        final provider = paymentProvider ?? paidVia;
        if (provider != null && provider.isNotEmpty) {
          parts.add(provider == 'stripe'
              ? 'Stripe'
              : provider == 'helloasso'
                  ? 'HelloAsso'
                  : provider);
        }
      case FeePaymentEventTypes.adjustAbsolute:
        parts.add(
          'Total payé : ${AppCopy.fees.formatEventAmountCents(amountPaidCentsAfter)}'
          ' (${AppCopy.fees.formatEventDeltaCents(deltaCents)})',
        );
      case FeePaymentEventTypes.aidValidated:
      case FeePaymentEventTypes.aidRejected:
        final label = aidLabel?.trim();
        if (label != null && label.isNotEmpty) parts.add(label);
        if (aidAmountCents != null) {
          parts.add(AppCopy.fees.formatEventAmountCents(aidAmountCents!));
        }
      case FeePaymentEventTypes.markedPaid:
      case FeePaymentEventTypes.exempted:
      case FeePaymentEventTypes.unexempted:
        break;
      default:
        if (deltaCents != 0) {
          parts.add(AppCopy.fees.formatEventDeltaCents(deltaCents));
        }
    }
    final trimmedNote = note?.trim();
    if (trimmedNote != null && trimmedNote.isNotEmpty) {
      parts.add(trimmedNote);
    }
    return parts.join(' · ');
  }
}

/// Construit le payload Firestore d'un événement (sans `createdAt`).
Map<String, dynamic> feePaymentEventPayload({
  required String type,
  required int deltaCents,
  required int amountPaidCentsBefore,
  required int amountPaidCentsAfter,
  required String statusAfter,
  required String actorUid,
  String? offlineMethod,
  String? paidVia,
  String? paymentProvider,
  String? externalPaymentId,
  String? sessionId,
  String? aidId,
  String? aidLabel,
  int? aidAmountCents,
  String? note,
}) {
  return <String, dynamic>{
    FirestoreFields.type: type,
    FirestoreFields.deltaCents: deltaCents,
    FirestoreFields.amountPaidCentsBefore: amountPaidCentsBefore,
    FirestoreFields.amountPaidCentsAfter: amountPaidCentsAfter,
    FirestoreFields.statusAfter: statusAfter,
    FirestoreFields.actorUid: actorUid,
    if (offlineMethod != null && offlineMethod.isNotEmpty)
      FirestoreFields.offlineMethod: offlineMethod,
    if (paidVia != null && paidVia.isNotEmpty) FirestoreFields.paidVia: paidVia,
    if (paymentProvider != null && paymentProvider.isNotEmpty)
      FirestoreFields.paymentProvider: paymentProvider,
    if (externalPaymentId != null && externalPaymentId.isNotEmpty)
      FirestoreFields.externalPaymentId: externalPaymentId,
    if (sessionId != null && sessionId.isNotEmpty)
      FirestoreFields.sessionId: sessionId,
    if (aidId != null && aidId.isNotEmpty) FirestoreFields.aidId: aidId,
    if (aidLabel != null && aidLabel.isNotEmpty)
      FirestoreFields.aidLabel: aidLabel,
    if (aidAmountCents != null) FirestoreFields.aidAmountCents: aidAmountCents,
    if (note case final n? when n.trim().isNotEmpty)
      FirestoreFields.note: n.trim(),
  };
}
