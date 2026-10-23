import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:posthog_flutter/posthog_flutter.dart';
import 'package:viro_team_v2/config/project_config.dart';

/// Client d'envoi d'événements (PostHog en prod, faux client en tests).
abstract class AnalyticsClient {
  /// Initialise le SDK avec [apiKey] ; [optOut] = aucun envoi tant que
  /// l'utilisateur n'a pas consenti.
  Future<void> setup({
    required String apiKey,
    required String host,
    required bool optOut,
  });

  /// Envoie [eventName] avec des [properties] optionnelles.
  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
  });

  /// Active ([enabled]) ou coupe l'envoi (choix de consentement).
  Future<void> setEnabled(bool enabled);

  /// Rattache les événements suivants à [userId] (uid Firebase).
  Future<void> identify({
    required String userId,
    Map<String, Object>? userProperties,
    Map<String, Object>? userPropertiesSetOnce,
  });

  /// Rattache les événements suivants au groupe [groupKey] de type [groupType].
  Future<void> group({
    required String groupType,
    required String groupKey,
    Map<String, Object>? groupProperties,
  });

  /// Propriété ajoutée à tous les événements suivants.
  Future<void> register(String key, Object value);

  /// Oublie l'utilisateur identifié (déconnexion).
  Future<void> reset();
}

/// Client PostHog natif (Android / iOS, init manuelle : `AUTO_INIT` à false).
class PosthogAnalyticsClient implements AnalyticsClient {
  @override
  Future<void> setup({
    required String apiKey,
    required String host,
    required bool optOut,
  }) {
    final config = PostHogConfig(apiKey)
      ..host = host
      ..captureApplicationLifecycleEvents = true
      ..personProfiles = PostHogPersonProfiles.identifiedOnly
      ..optOut = optOut;
    return Posthog().setup(config);
  }

  @override
  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
  }) {
    return Posthog().capture(eventName: eventName, properties: properties);
  }

  @override
  Future<void> setEnabled(bool enabled) =>
      enabled ? Posthog().enable() : Posthog().disable();

  @override
  Future<void> identify({
    required String userId,
    Map<String, Object>? userProperties,
    Map<String, Object>? userPropertiesSetOnce,
  }) {
    return Posthog().identify(
      userId: userId,
      userProperties: userProperties,
      userPropertiesSetOnce: userPropertiesSetOnce,
    );
  }

  @override
  Future<void> group({
    required String groupType,
    required String groupKey,
    Map<String, Object>? groupProperties,
  }) {
    return Posthog().group(
      groupType: groupType,
      groupKey: groupKey,
      groupProperties: groupProperties,
    );
  }

  @override
  Future<void> register(String key, Object value) =>
      Posthog().register(key, value);

  @override
  Future<void> reset() => Posthog().reset();
}

/// Analytics produit : best-effort, jamais bloquant, sans PII.
///
/// Sans clé PostHog pour l'environnement courant
/// ([ProjectConfig.posthogApiKey] vide), tout est ignoré.
class AnalyticsService {
  AnalyticsService({AnalyticsClient? client, String? apiKey})
    : _client = client ?? PosthogAnalyticsClient(),
      _apiKey = apiKey ?? ProjectConfig.posthogApiKey;

  final AnalyticsClient _client;
  final String _apiKey;
  bool _started = false;

  /// Type de groupe PostHog pour le club actif.
  static const String clubGroupType = 'club';

  /// Initialise PostHog ; [consented] à false = SDK prêt mais muet.
  Future<void> start({required bool consented}) async {
    if (_started || _apiKey.isEmpty) return;
    _started = true;
    await _safe(() async {
      await _client.setup(
        apiKey: _apiKey,
        host: ProjectConfig.posthogHost,
        optOut: !consented,
      );
      await _registerBaseProperties();
    });
  }

  /// Capture un événement. Ajoute `app_env` (`debug` / `release`) pour filtrer.
  void capture(String eventName, [Map<String, Object>? properties]) {
    unawaited(
      _safe(
        () => _client.capture(
          eventName: eventName,
          properties: {
            'app_env': kReleaseMode ? 'release' : 'debug',
            ...?properties,
          },
        ),
      ),
    );
  }

  /// Applique le choix de consentement (envoi coupé si [granted] est false).
  Future<void> setConsent(bool granted) {
    if (!_started) return Future.value();
    return _safe(() => _client.setEnabled(granted));
  }

  /// Identifie l'utilisateur [userId] avec ses propriétés (sans PII).
  /// [propertiesSetOnce] ne remplace jamais une valeur déjà connue.
  Future<void> identifyUser({
    required String userId,
    required Map<String, Object> properties,
    Map<String, Object>? propertiesSetOnce,
  }) {
    if (!_started) return Future.value();
    return _safe(
      () => _client.identify(
        userId: userId,
        userProperties: properties,
        userPropertiesSetOnce: propertiesSetOnce,
      ),
    );
  }

  /// Rattache les événements suivants au club [clubId].
  Future<void> setActiveClub({
    required String clubId,
    required Map<String, Object> properties,
  }) {
    if (!_started) return Future.value();
    return _safe(
      () => _client.group(
        groupType: clubGroupType,
        groupKey: clubId,
        groupProperties: properties,
      ),
    );
  }

  /// Déconnexion : oublie l'utilisateur et le club, garde les propriétés
  /// communes (`surface`, `app_env`).
  Future<void> resetIdentity() {
    if (!_started) return Future.value();
    return _safe(() async {
      await _client.reset();
      await _registerBaseProperties();
    });
  }

  Future<void> _registerBaseProperties() async {
    await _client.register('surface', 'app');
    await _client.register('app_env', kReleaseMode ? 'release' : 'debug');
  }

  Future<void> _safe(Future<void> Function() action) async {
    try {
      await action();
    } catch (_) {
      // L'analytics ne doit jamais impacter le parcours utilisateur.
    }
  }
}
