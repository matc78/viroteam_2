import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/services/analytics_service.dart';

import '../helpers/recording_analytics_client.dart';

void main() {
  late RecordingAnalyticsClient client;

  setUp(() => client = RecordingAnalyticsClient());

  group('AnalyticsService sans clé', () {
    test('ne démarre pas et ignore identité / consentement', () async {
      final analytics = AnalyticsService(client: client, apiKey: '');

      await analytics.start(consented: true);
      await analytics.setConsent(true);
      await analytics.identifyUser(userId: 'u1', properties: {'a': 1});
      await analytics.setActiveClub(clubId: 'c1', properties: {});
      await analytics.resetIdentity();

      expect(client.calls, isEmpty);
    });
  });

  group('AnalyticsService avec clé', () {
    late AnalyticsService analytics;

    setUp(() => analytics = AnalyticsService(client: client, apiKey: 'phc_test'));

    test('sans consentement : SDK initialisé muet', () async {
      await analytics.start(consented: false);

      expect(client.setupOptOut, isTrue);
      expect(client.registered['surface'], 'app');
      expect(client.registered.containsKey('app_env'), isTrue);
    });

    test('start est idempotent', () async {
      await analytics.start(consented: true);
      await analytics.start(consented: true);

      expect(client.calls.where((call) => call == 'setup'), hasLength(1));
    });

    test('setConsent active ou coupe l’envoi', () async {
      await analytics.start(consented: false);

      await analytics.setConsent(true);
      expect(client.enabled, isTrue);

      await analytics.setConsent(false);
      expect(client.enabled, isFalse);
    });

    test('identifie l’utilisateur et le club actif', () async {
      await analytics.start(consented: true);

      await analytics.identifyUser(
        userId: 'u1',
        properties: {'max_role': 'coach'},
        propertiesSetOnce: {'signup_at': '2026-10-01T00:00:00.000Z'},
      );
      await analytics.setActiveClub(clubId: 'c1', properties: {'sport': 'foot'});

      expect(client.identified?.userId, 'u1');
      expect(client.identified?.setOnce, {
        'signup_at': '2026-10-01T00:00:00.000Z',
      });
      expect(client.grouped?.groupType, AnalyticsService.clubGroupType);
      expect(client.grouped?.groupKey, 'c1');
    });

    test('resetIdentity rejoue les propriétés communes', () async {
      await analytics.start(consented: true);
      client.calls.clear();

      await analytics.resetIdentity();

      expect(client.calls.first, 'reset');
      expect(client.registered['surface'], 'app');
    });
  });
}
