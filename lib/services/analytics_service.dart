import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

/// Client d'envoi d'événements (PostHog en prod, faux client en tests).
abstract class AnalyticsClient {
  /// Envoie [eventName] avec des [properties] optionnelles.
  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
  });
}

/// Client PostHog natif (Android / iOS, auto-init via manifest / Info.plist).
class PosthogAnalyticsClient implements AnalyticsClient {
  @override
  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
  }) {
    return Posthog().capture(eventName: eventName, properties: properties);
  }
}

/// Analytics produit : best-effort, jamais bloquant, sans PII.
class AnalyticsService {
  AnalyticsService({AnalyticsClient? client})
    : _client = client ?? PosthogAnalyticsClient();

  final AnalyticsClient _client;

  /// Capture un événement. Ajoute `app_env` (`debug` / `release`) pour filtrer.
  void capture(String eventName, [Map<String, Object>? properties]) {
    unawaited(_safeCapture(eventName, properties));
  }

  Future<void> _safeCapture(
    String eventName,
    Map<String, Object>? properties,
  ) async {
    try {
      await _client.capture(
        eventName: eventName,
        properties: {
          'app_env': kReleaseMode ? 'release' : 'debug',
          ...?properties,
        },
      );
    } catch (_) {
      // L'analytics ne doit jamais impacter le parcours utilisateur.
    }
  }
}
