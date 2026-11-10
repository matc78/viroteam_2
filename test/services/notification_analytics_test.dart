import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/services/analytics_service.dart';
import 'package:viro_team_v2/services/notification_analytics.dart';

import '../helpers/recording_analytics_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late RecordingAnalyticsClient client;
  late NotificationAnalytics analytics;

  setUp(() {
    client = RecordingAnalyticsClient();
    analytics = NotificationAnalytics(
      analytics: AnalyticsService(client: client),
    );
  });

  Future<void> flushCaptures() => Future<void>.delayed(Duration.zero);

  group('NotificationAnalytics', () {
    test('trackOpened envoie type et preference_key', () async {
      analytics.trackOpened(
        notificationType: 'event_created',
        preferenceKey: 'events',
      );
      await flushCaptures();

      expect(client.captures, hasLength(1));
      final capture = client.captures.single;
      expect(capture.eventName, NotificationAnalytics.openedEvent);
      expect(
        capture.properties,
        containsPair('notification_type', 'event_created'),
      );
      expect(capture.properties, containsPair('preference_key', 'events'));
      expect(capture.properties!.containsKey('deepLink'), isFalse);
      expect(
        capture.properties,
        containsPair('app_env', kReleaseMode ? 'release' : 'debug'),
      );
    });

    test('trackOpened ignore un type vide', () async {
      analytics.trackOpened(notificationType: '  ', preferenceKey: 'events');
      analytics.trackOpened(notificationType: null);
      await flushCaptures();

      expect(client.captures, isEmpty);
    });

    test('trackOpened omet preference_key si vide', () async {
      analytics.trackOpened(
        notificationType: 'fee_reminder',
        preferenceKey: '',
      );
      await flushCaptures();

      expect(
        client.captures.single.properties!.containsKey('preference_key'),
        isFalse,
      );
    });
  });

  group('encode / decode payload notif locale', () {
    test('sans métadonnées renvoie le deep link brut', () {
      expect(
        encodeLocalNotificationPayload(deepLink: 'viro://club/abc'),
        'viro://club/abc',
      );
    });

    test('avec type encode un JSON et le décode', () {
      final payload = encodeLocalNotificationPayload(
        deepLink: 'viro://planning/1',
        notificationType: 'event_reminder_j2',
        preferenceKey: 'events',
      );
      expect(payload.startsWith('{'), isTrue);

      final decoded = decodeLocalNotificationPayload(payload);
      expect(decoded.deepLink, 'viro://planning/1');
      expect(decoded.notificationType, 'event_reminder_j2');
      expect(decoded.preferenceKey, 'events');
    });

    test('deep link historique sans JSON reste lisible', () {
      final decoded = decodeLocalNotificationPayload('viro://club/xyz');
      expect(decoded.deepLink, 'viro://club/xyz');
      expect(decoded.notificationType, isNull);
      expect(decoded.preferenceKey, isNull);
    });

    test('payload vide ou null ne plante pas', () {
      expect(encodeLocalNotificationPayload(deepLink: null), '');
      expect(encodeLocalNotificationPayload(deepLink: ''), '');
      final decoded = decodeLocalNotificationPayload(null);
      expect(decoded.deepLink, isNull);
    });
  });
}
