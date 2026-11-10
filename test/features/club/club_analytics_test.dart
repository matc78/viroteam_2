import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/club/services/club_analytics.dart';
import 'package:viro_team_v2/services/analytics_service.dart';

import '../../helpers/recording_analytics_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late RecordingAnalyticsClient client;
  late ClubAnalytics analytics;

  setUp(() {
    client = RecordingAnalyticsClient();
    analytics = ClubAnalytics(analytics: AnalyticsService(client: client));
  });

  Future<void> flushCaptures() => Future<void>.delayed(Duration.zero);

  group('ClubAnalytics', () {
    test('trackActionTapped envoie action, role et zone', () async {
      analytics.trackActionTapped(
        action: ClubAnalytics.actionPlanning,
        role: 'coach',
        zone: ClubAnalytics.zoneManagement,
      );
      await flushCaptures();

      expect(client.captures, hasLength(1));
      final capture = client.captures.single;
      expect(capture.eventName, ClubAnalytics.actionTappedEvent);
      expect(capture.properties, containsPair('action', 'planning'));
      expect(capture.properties, containsPair('role', 'coach'));
      expect(capture.properties, containsPair('zone', 'management'));
      expect(capture.properties!.containsKey('club_id'), isFalse);
      expect(
        capture.properties,
        containsPair('app_env', kReleaseMode ? 'release' : 'debug'),
      );
    });

    test('ids d’action et de zone restent stables', () {
      expect(ClubAnalytics.actionTeams, 'teams');
      expect(ClubAnalytics.actionMyFee, 'my_fee');
      expect(ClubAnalytics.actionMembers, 'members');
      expect(ClubAnalytics.zoneShortcut, 'shortcut');
      expect(ClubAnalytics.zoneFamily, 'family');
    });
  });
}
