import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/features/fees/models/fee_aid.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';

/// Merchant ID Apple Pay (à aligner avec le provisioning Apple / Stripe).
const String kStripeApplePayMerchantId = 'merchant.com.viroteam.app';

/// Facteur d’échelle typo PaymentSheet (champs CB plus grands / plus faciles à taper).
/// Non exposé en Dart par flutter_stripe 11 — injecté via `appearance.font.scale` natif.
const double kStripePaymentSheetFontScale = 1.35;

/// Contrat paiement cotisations in-app.
///
/// Le marquage `paye` / crédit `amountPaidCents` se fait uniquement via
/// webhook Cloud Functions — jamais depuis le retour client.
abstract class PaymentService {
  /// Indique si le paiement in-app est disponible.
  bool get isInAppPaymentEnabled;

  /// Démarre un checkout (éventuellement aides ; 1× Stripe v1).
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

/// Paiement via Stripe Connect (callable PaymentIntent + PaymentSheet).
class StripePaymentService implements PaymentService {
  StripePaymentService({FirebaseFunctions? functions})
      : _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFunctions _functions;

  @override
  bool get isInAppPaymentEnabled =>
      FeatureFlags.inAppPayments && FeatureFlags.stripePaymentsLive;

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
    if (!isInAppPaymentEnabled) {
      return PaymentCheckoutResult.unavailable();
    }
    if (amountCents <= 0 && aids.isEmpty) {
      return const PaymentCheckoutResult(
        status: PaymentCheckoutStatus.failed,
        message: 'Montant invalide',
      );
    }

    try {
      final callable =
          _functions.httpsCallable(cloudCallableName('createStripeCheckout'));
      final response = await callable.call<Map<String, dynamic>>({
        'clubId': clubId,
        'seasonId': seasonId,
        'memberId': memberId,
        'amountCents': amountCents,
        'currency': currency.toLowerCase(),
        'aids': aids.map((a) => a.toCallableMap()).toList(),
        'provider': FeePaymentProviders.stripe,
      });

      final data = response.data;
      final clientSecret = data['clientSecret'] as String?;
      final publishableKey = data['publishableKey'] as String?;
      final paymentIntentId = data['paymentIntentId']?.toString();
      final sessionId = data['sessionId'] as String?;

      if (clientSecret == null ||
          clientSecret.isEmpty ||
          publishableKey == null ||
          publishableKey.isEmpty) {
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
              'Stripe n\'a pas renvoyé de client_secret',
        );
      }

      Stripe.publishableKey = publishableKey;
      Stripe.merchantIdentifier = kStripeApplePayMerchantId;
      await Stripe.instance.applySettings();

      await _initPaymentSheetWithLargerInputs(clientSecret: clientSecret);
      await Stripe.instance.presentPaymentSheet();

      return PaymentCheckoutResult(
        status: PaymentCheckoutStatus.started,
        externalPaymentId: paymentIntentId,
        sessionId: sessionId,
        message:
            'Paiement envoyé. Le statut se mettra à jour après confirmation '
            'serveur (pas immédiatement).',
      );
    } on StripeException catch (e) {
      if (e.error.code == FailureCode.Canceled) {
        return const PaymentCheckoutResult(
          status: PaymentCheckoutStatus.cancelled,
          message: 'Paiement annulé',
        );
      }
      return PaymentCheckoutResult(
        status: PaymentCheckoutStatus.failed,
        message: e.error.localizedMessage ?? 'Erreur Stripe',
      );
    } on FirebaseFunctionsException catch (e) {
      return PaymentCheckoutResult(
        status: PaymentCheckoutStatus.failed,
        message: e.message ?? 'Erreur Stripe (${e.code})',
      );
    } catch (e) {
      return PaymentCheckoutResult(
        status: PaymentCheckoutStatus.failed,
        message: 'Erreur paiement : $e',
      );
    }
  }
}

/// Initialise le PaymentSheet avec une typo agrandie (champs CB plus confortables).
///
/// `flutter_stripe` 11 n’expose pas `appearance.font.scale` en Dart, alors que
/// les SDK natifs Android/iOS le supportent — on l’injecte dans le payload.
/// Si le MethodChannel échoue, repli sur [Stripe.instance.initPaymentSheet]
/// (sans scale, mais paiement toujours possible).
Future<void> _initPaymentSheetWithLargerInputs({
  required String clientSecret,
}) async {
  final parameters = SetupPaymentSheetParameters(
    paymentIntentClientSecret: clientSecret,
    merchantDisplayName: 'ViroTeam',
    style: ThemeMode.system,
    // Carte + wallets d'abord ; le reste (Bancontact, Klarna…) suit
    // dans l'ordre dynamique Stripe.
    paymentMethodOrder: const [
      'card',
      'apple_pay',
      'google_pay',
    ],
    googlePay: PaymentSheetGooglePay(
      merchantCountryCode: 'FR',
      testEnv: !kReleaseMode,
    ),
    applePay: const PaymentSheetApplePay(
      merchantCountryCode: 'FR',
    ),
    appearance: PaymentSheetAppearance(
      colors: PaymentSheetAppearanceColors(
        primary: ViroColors.primary600,
        componentBackground: ViroColors.gray50,
        componentBorder: ViroColors.gray200,
        componentText: ViroColors.gray900,
        primaryText: ViroColors.gray900,
        secondaryText: ViroColors.gray600,
        placeholderText: ViroColors.gray400,
      ),
      shapes: const PaymentSheetShape(
        borderRadius: 14,
        borderWidth: 1.5,
      ),
    ),
  );

  try {
    final paramsJson = Map<String, dynamic>.from(parameters.toJson());
    final appearanceJson = Map<String, dynamic>.from(
      (paramsJson['appearance'] as Map?)?.cast<String, dynamic>() ??
          <String, dynamic>{},
    );
    appearanceJson['font'] = const {'scale': kStripePaymentSheetFontScale};
    paramsJson['appearance'] = appearanceJson;

    const channel = MethodChannel('flutter.stripe/payments');
    await channel.invokeMethod('initPaymentSheet', {'params': paramsJson});
  } catch (_) {
    await Stripe.instance.initPaymentSheet(paymentSheetParameters: parameters);
  }
}

/// Paiement via HelloAsso (callable + ouverture du redirectUrl) — dormant.
class HelloAssoPaymentService implements PaymentService {
  HelloAssoPaymentService({FirebaseFunctions? functions})
      : _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFunctions _functions;

  @override
  bool get isInAppPaymentEnabled =>
      FeatureFlags.inAppPayments && FeatureFlags.helloAssoPaymentsLive;

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
    if (!isInAppPaymentEnabled) {
      return PaymentCheckoutResult.unavailable();
    }
    if (amountCents <= 0 && aids.isEmpty) {
      return const PaymentCheckoutResult(
        status: PaymentCheckoutStatus.failed,
        message: 'Montant invalide',
      );
    }

    try {
      final callable = _functions
          .httpsCallable(cloudCallableName('createHelloAssoCheckout'));
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
