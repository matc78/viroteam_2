import 'package:viro_team_v2/config/feature_flags.dart';

/// Contrat paiement cotisations in-app.
///
/// Prestataire non choisi (candidat Stripe). L'implémentation active est
/// [NoopPaymentService] jusqu'au branchement réel + webhook Cloud Functions.
abstract class PaymentService {
  /// Indique si le paiement in-app est disponible pour ce club.
  bool get isInAppPaymentEnabled;

  /// Démarre un paiement pour la cotisation du membre.
  Future<PaymentCheckoutResult> createCheckout({
    required String clubId,
    required String seasonId,
    required String memberId,
    required int amountCents,
    required String currency,
  });
}

/// Résultat d'une tentative de checkout.
class PaymentCheckoutResult {
  const PaymentCheckoutResult({
    required this.status,
    this.externalPaymentId,
    this.message,
  });

  final PaymentCheckoutStatus status;
  final String? externalPaymentId;
  final String? message;

  static PaymentCheckoutResult unavailable([String? message]) =>
      PaymentCheckoutResult(
        status: PaymentCheckoutStatus.unavailable,
        message: message ??
            'Le paiement en ligne sera bientôt disponible. '
                'Utilisez les consignes du club en attendant.',
      );
}

enum PaymentCheckoutStatus {
  unavailable,
  started,
  cancelled,
  failed,
}

/// Implémentation provisoire : pas de prestataire branché.
class NoopPaymentService implements PaymentService {
  @override
  bool get isInAppPaymentEnabled => FeatureFlags.inAppPayments;

  @override
  Future<PaymentCheckoutResult> createCheckout({
    required String clubId,
    required String seasonId,
    required String memberId,
    required int amountCents,
    required String currency,
  }) async {
    if (!FeatureFlags.inAppPayments) {
      return PaymentCheckoutResult.unavailable();
    }
    return PaymentCheckoutResult.unavailable(
      'Prestataire de paiement non configuré',
    );
  }
}
