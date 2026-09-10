import 'package:flutter/foundation.dart';

/// Feature flags simples (debug / release).
abstract final class FeatureFlags {
  /// Écrans ou flux encore incomplets (uniquement en debug par défaut).
  static bool get showIncompleteFeatures => kDebugMode;

  /// Paiement in-app (callable + PaymentSheet / webhook).
  /// Désactiver si les secrets Functions ne sont pas déployés.
  static const bool inAppPayments = true;

  /// Paiement CB HelloAsso live (partenariat + secrets) — dormant.
  static const bool helloAssoPaymentsLive = false;

  /// Paiement CB Stripe Connect live (secrets Functions + Connect club).
  /// Actif en debug pour tester avec les clés `*_TEST`.
  static bool get stripePaymentsLive => kDebugMode || _stripePaymentsLiveRelease;

  /// Flip à `true` pour activer Stripe aussi en release (après clés live).
  static const bool _stripePaymentsLiveRelease = false;
}
