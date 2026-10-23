import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/analytics_consent_service.dart';

/// Consentement à la mesure d'audience, persisté sur l'appareil.
class AnalyticsConsentNotifier extends Notifier<AnalyticsConsent> {
  @override
  AnalyticsConsent build() =>
      ref.read(analyticsConsentServiceProvider).readSync();

  /// Applique [granted] immédiatement (PostHog activé / coupé) puis
  /// l'enregistre.
  Future<void> select({required bool granted}) async {
    final next = granted ? AnalyticsConsent.granted : AnalyticsConsent.denied;
    if (state == next) return;
    state = next;
    await ref.read(analyticsServiceProvider).setConsent(granted);
    await ref.read(analyticsConsentServiceProvider).write(next);
  }
}

final analyticsConsentProvider =
    NotifierProvider<AnalyticsConsentNotifier, AnalyticsConsent>(
  AnalyticsConsentNotifier.new,
);
