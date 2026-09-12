import 'package:viro_team_v2/services/analytics_service.dart';

/// Événements PostHog du parcours cotisations / Stripe (sans PII).
class FeePaymentAnalytics {
  FeePaymentAnalytics({required AnalyticsService analytics})
      : _analytics = analytics;

  final AnalyticsService _analytics;

  static const String startedEvent = 'fee_payment_started';
  static const String submittedEvent = 'fee_payment_submitted';
  static const String cancelledEvent = 'fee_payment_cancelled';
  static const String failedEvent = 'fee_payment_failed';
  static const String connectStartedEvent = 'fee_connect_started';
  static const String connectFailedEvent = 'fee_connect_failed';

  static const String surfaceApp = 'app';
  static const String surfacePortal = 'portal';

  /// Callable checkout OK, avant PaymentSheet / Payment Element.
  void trackStarted({
    required String surface,
    required int amountCents,
    required String currency,
    required int aidCount,
    required bool hasSession,
  }) {
    _analytics.capture(startedEvent, {
      'surface': surface,
      'amount_cents': amountCents,
      'currency': currency.toLowerCase(),
      'aid_count': aidCount,
      'has_session': hasSession,
    });
  }

  /// Confirmation client (Sheet/Element) — le crédit reste côté webhook.
  void trackSubmitted({
    required String surface,
    required int amountCents,
    required String currency,
    required int aidCount,
  }) {
    _analytics.capture(submittedEvent, {
      'surface': surface,
      'amount_cents': amountCents,
      'currency': currency.toLowerCase(),
      'aid_count': aidCount,
      'provider': 'stripe',
    });
  }

  /// Annulation utilisateur.
  void trackCancelled({
    required String surface,
    required String stage,
  }) {
    _analytics.capture(cancelledEvent, {
      'surface': surface,
      'stage': stage,
    });
  }

  /// Échec callable / Stripe / exception (code technique uniquement).
  void trackFailed({
    required String surface,
    required String stage,
    String errorCode = 'unknown',
  }) {
    _analytics.capture(failedEvent, {
      'surface': surface,
      'stage': stage,
      'error_code': errorCode,
    });
  }

  /// Clic onboarding Stripe Connect (portail).
  void trackConnectStarted({required String surface}) {
    _analytics.capture(connectStartedEvent, {
      'surface': surface,
    });
  }

  /// Échec Connect / refresh status.
  void trackConnectFailed({
    required String surface,
    String errorCode = 'unknown',
  }) {
    _analytics.capture(connectFailedEvent, {
      'surface': surface,
      'error_code': errorCode,
    });
  }
}
