import 'package:flutter/foundation.dart';

/// Feature flags simples (debug / release).
abstract final class FeatureFlags {
  /// Paiement in-app (callable + PaymentSheet / webhook).
  /// Désactiver si les secrets Functions ne sont pas déployés.
  static const bool inAppPayments = true;

  /// Paiement CB Stripe Connect live (secrets Functions + Connect club).
  /// Actif en debug pour tester avec les clés `*_TEST`.
  static bool get stripePaymentsLive => kDebugMode || _stripePaymentsLiveRelease;

  /// Flip à `true` pour activer Stripe aussi en release (après clés live).
  static const bool _stripePaymentsLiveRelease = true;

  /// Préparation de séance des coachs (exercices, schémas, bibliothèque des
  /// séances passées), synchronisée avec la page Séances du portail. Active
  /// en debug comme en release.
  static bool get trainingPrepLive => _trainingPrepLive;

  static const bool _trainingPrepLive = true;

  /// Retours de séance (notes collectives + messages perso, page Feedback,
  /// bouton d'accueil). **Dormant, conservé volontairement** : caché même en
  /// debug, routes redirigées vers l'accueil. Ne pas supprimer le code.
  static bool get trainingFeedbackLive => _trainingFeedbackLive;

  static const bool _trainingFeedbackLive = false;
}
