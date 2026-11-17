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

  /// Pointage des présences (appel coach) : bouton « Faire l'appel » du
  /// détail d'un événement et capacité coach « Prendre les présences ».
  /// Masqué tant que la fonctionnalité n'est pas mise en avant ; le code et
  /// les données (`attendance`, `coachPermissions.canTakeAttendance`)
  /// restent en place.
  static const bool attendanceTracking = false;
}
