import 'package:flutter/foundation.dart';

/// Feature flags simples (debug / release).
abstract final class FeatureFlags {
  /// Écrans ou flux encore incomplets (uniquement en debug par défaut).
  static bool get showIncompleteFeatures => kDebugMode;

  /// Paiement in-app HelloAsso (callable + webhook).
  /// Désactiver si les secrets Functions ne sont pas déployés.
  static const bool inAppPayments = true;
}
