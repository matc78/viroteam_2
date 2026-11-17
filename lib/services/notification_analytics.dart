import 'dart:convert';

import 'package:viro_team_v2/services/analytics_service.dart';

/// Événements PostHog liés aux notifications push (sans PII ni deep link).
class NotificationAnalytics {
  NotificationAnalytics({required AnalyticsService analytics})
    : _analytics = analytics;

  final AnalyticsService _analytics;

  static const String openedEvent = 'notification_opened';

  /// Signale un tap sur une notif (FCM ou locale).
  ///
  /// [notificationType] = `data.type` serveur ; [preferenceKey] optionnel.
  void trackOpened({
    required String? notificationType,
    String? preferenceKey,
  }) {
    final type = notificationType?.trim() ?? '';
    if (type.isEmpty) return;
    _analytics.capture(openedEvent, {
      'notification_type': type,
      if (preferenceKey != null && preferenceKey.isNotEmpty)
        'preference_key': preferenceKey,
    });
  }
}

/// Encode le payload d'une notif locale : deep link seul (compat) ou JSON
/// avec type / préférence pour l'analytics au tap.
String encodeLocalNotificationPayload({
  required String? deepLink,
  String? notificationType,
  String? preferenceKey,
}) {
  if (deepLink == null || deepLink.isEmpty) return '';
  final hasType = notificationType != null && notificationType.isNotEmpty;
  final hasPreference =
      preferenceKey != null && preferenceKey.isNotEmpty;
  if (!hasType && !hasPreference) return deepLink;
  return jsonEncode({
    'deepLink': deepLink,
    if (hasType) 'notification_type': notificationType,
    if (hasPreference) 'preference_key': preferenceKey,
  });
}

/// Décode un payload notif locale (JSON enrichi ou deep link brut).
({String? deepLink, String? notificationType, String? preferenceKey})
decodeLocalNotificationPayload(String? payload) {
  if (payload == null || payload.isEmpty) {
    return (
      deepLink: null,
      notificationType: null,
      preferenceKey: null,
    );
  }
  final trimmed = payload.trim();
  if (trimmed.startsWith('{')) {
    try {
      final map = jsonDecode(trimmed) as Map<String, dynamic>;
      return (
        deepLink: map['deepLink']?.toString(),
        notificationType: map['notification_type']?.toString(),
        preferenceKey: map['preference_key']?.toString(),
      );
    } catch (_) {
      return (
        deepLink: payload,
        notificationType: null,
        preferenceKey: null,
      );
    }
  }
  return (
    deepLink: payload,
    notificationType: null,
    preferenceKey: null,
  );
}
