import 'package:cloud_functions/cloud_functions.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/features/fees/models/fee_aid.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';

/// Contrat paiement cotisations in-app (HelloAsso).
///
/// Le marquage `paye` / crédit `amountPaidCents` se fait uniquement via
/// webhook Cloud Functions — jamais depuis le retour URL client.
abstract class PaymentService {
  /// Indique si le paiement in-app est disponible.
  bool get isInAppPaymentEnabled;

  /// Démarre un checkout HelloAsso (éventuellement 3× + aides).
  Future<PaymentCheckoutResult> createCheckout({
    required String clubId,
    required String seasonId,
    required String memberId,
    required int amountCents,
    required String currency,
    int installmentCount = 1,
    List<FeeAidDraft> aids = const [],
    String? returnUrl,
    String? backUrl,
    String? errorUrl,
  });
}

/// Brouillon d'aide saisi côté UI avant envoi à la callable.
class FeeAidDraft {
  const FeeAidDraft({
    required this.type,
    required this.amountCents,
    this.promoCode,
    this.label,
  });

  final String type;
  final int amountCents;
  final String? promoCode;
  final String? label;

  Map<String, dynamic> toCallableMap() => {
        'type': type,
        'amountCents': amountCents,
        if (promoCode != null && promoCode!.trim().isNotEmpty)
          'promoCode': promoCode!.trim(),
        'label': label ?? FeeAidTypes.label(type),
      };
}

/// Résultat d'une tentative de checkout.
class PaymentCheckoutResult {
  const PaymentCheckoutResult({
    required this.status,
    this.externalPaymentId,
    this.redirectUrl,
    this.sessionId,
    this.message,
  });

  final PaymentCheckoutStatus status;
  final String? externalPaymentId;
  final String? redirectUrl;
  final String? sessionId;
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
    int installmentCount = 1,
    List<FeeAidDraft> aids = const [],
    String? returnUrl,
    String? backUrl,
    String? errorUrl,
  }) async {
    if (!FeatureFlags.inAppPayments) {
      return PaymentCheckoutResult.unavailable();
    }
    return PaymentCheckoutResult.unavailable(
      'Prestataire de paiement non configuré',
    );
  }
}

/// Paiement via HelloAsso (callable + ouverture du redirectUrl).
class HelloAssoPaymentService implements PaymentService {
  HelloAssoPaymentService({FirebaseFunctions? functions})
      : _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFunctions _functions;

  @override
  bool get isInAppPaymentEnabled => FeatureFlags.inAppPayments;

  @override
  Future<PaymentCheckoutResult> createCheckout({
    required String clubId,
    required String seasonId,
    required String memberId,
    required int amountCents,
    required String currency,
    int installmentCount = 1,
    List<FeeAidDraft> aids = const [],
    String? returnUrl,
    String? backUrl,
    String? errorUrl,
  }) async {
    if (!FeatureFlags.inAppPayments) {
      return PaymentCheckoutResult.unavailable();
    }
    if (amountCents <= 0 && aids.isEmpty) {
      return const PaymentCheckoutResult(
        status: PaymentCheckoutStatus.failed,
        message: 'Montant invalide',
      );
    }

    try {
      final callable = _functions.httpsCallable('createHelloAssoCheckout');
      final response = await callable.call<Map<String, dynamic>>({
        'clubId': clubId,
        'seasonId': seasonId,
        'memberId': memberId,
        'amountCents': amountCents,
        'currency': currency,
        'installmentCount': installmentCount,
        'aids': aids.map((a) => a.toCallableMap()).toList(),
        'provider': FeePaymentProviders.helloasso,
        if (returnUrl != null) 'returnUrl': returnUrl,
        if (backUrl != null) 'backUrl': backUrl,
        if (errorUrl != null) 'errorUrl': errorUrl,
      });

      final data = response.data;
      final redirectUrl = data['redirectUrl'] as String?;
      final checkoutIntentId = data['checkoutIntentId']?.toString();
      final sessionId = data['sessionId'] as String?;

      if (redirectUrl == null || redirectUrl.isEmpty) {
        // Cas aides-only : pas de CB, session enregistrée côté serveur.
        if (data['ok'] == true) {
          return PaymentCheckoutResult(
            status: PaymentCheckoutStatus.started,
            sessionId: sessionId,
            message: data['message'] as String? ??
                'Aides enregistrées — en attente de justificatif',
          );
        }
        return PaymentCheckoutResult(
          status: PaymentCheckoutStatus.failed,
          message: data['message'] as String? ??
              'HelloAsso n\'a pas renvoyé d\'URL de paiement',
        );
      }

      final uri = Uri.parse(redirectUrl);
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        return PaymentCheckoutResult(
          status: PaymentCheckoutStatus.failed,
          externalPaymentId: checkoutIntentId,
          redirectUrl: redirectUrl,
          sessionId: sessionId,
          message: 'Impossible d\'ouvrir la page HelloAsso',
        );
      }

      return PaymentCheckoutResult(
        status: PaymentCheckoutStatus.started,
        externalPaymentId: checkoutIntentId,
        redirectUrl: redirectUrl,
        sessionId: sessionId,
        message:
            'Paiement ouvert sur HelloAsso. Le statut se mettra à jour '
            'après confirmation serveur (pas immédiatement au retour).',
      );
    } on FirebaseFunctionsException catch (e) {
      return PaymentCheckoutResult(
        status: PaymentCheckoutStatus.failed,
        message: e.message ?? 'Erreur HelloAsso (${e.code})',
      );
    } catch (e) {
      return PaymentCheckoutResult(
        status: PaymentCheckoutStatus.failed,
        message: 'Erreur paiement : $e',
      );
    }
  }
}
