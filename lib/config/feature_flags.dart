import 'package:flutter/foundation.dart';

/// Feature flags simples (debug / release).
abstract final class FeatureFlags {
  /// Écrans ou flux encore incomplets (uniquement en debug par défaut).
  static bool get showIncompleteFeatures => kDebugMode;

  /// Paiement in-app (désactivé tant que le prestataire n'est pas branché).
  static const bool inAppPayments = false;
}
