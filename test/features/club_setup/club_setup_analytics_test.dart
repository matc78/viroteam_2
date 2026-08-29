import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_steps.dart';
import 'package:viro_team_v2/features/club_setup/services/club_setup_analytics.dart';
import 'package:viro_team_v2/services/analytics_service.dart';

class _RecordingAnalyticsClient implements AnalyticsClient {
  final captures = <({String eventName, Map<String, Object>? properties})>[];

  @override
  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
  }) async {
    captures.add((eventName: eventName, properties: properties));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _RecordingAnalyticsClient client;
  late ClubSetupAnalytics analytics;

  setUp(() {
    client = _RecordingAnalyticsClient();
    analytics = ClubSetupAnalytics(analytics: AnalyticsService(client: client));
  });

  Future<void> flushCaptures() => Future<void>.delayed(Duration.zero);

  group('ClubSetupSteps.analyticsKey', () {
    test('mappe chaque étape vers une clé snake_case', () {
      expect(
        ClubSetupSteps.analyticsKey(ClubSetupSteps.prerequisites),
        'prerequisites',
      );
      expect(ClubSetupSteps.analyticsKey(ClubSetupSteps.identity), 'identity');
      expect(
        ClubSetupSteps.analyticsKey(ClubSetupSteps.objectives),
        'objectives',
      );
      expect(ClubSetupSteps.analyticsKey(ClubSetupSteps.location), 'location');
      expect(ClubSetupSteps.analyticsKey(ClubSetupSteps.recap), 'recap');
    });

    test('borne les indices hors plage', () {
      expect(ClubSetupSteps.analyticsKey(-1), 'prerequisites');
      expect(ClubSetupSteps.analyticsKey(99), 'recap');
      expect(ClubSetupSteps.clampIndex(-1), 0);
      expect(ClubSetupSteps.clampIndex(99), ClubSetupSteps.total - 1);
    });
  });

  group('ClubSetupAnalytics', () {
    test('trackStarted n\'envoie ni nom ni uid', () async {
      analytics.trackStarted(resumed: true, initialStep: 2);
      await flushCaptures();

      expect(client.captures, hasLength(1));
      final capture = client.captures.single;
      expect(capture.eventName, ClubSetupAnalytics.startedEvent);
      expect(capture.properties, containsPair('resumed', true));
      expect(capture.properties, containsPair('initial_step', 'objectives'));
      expect(
        capture.properties,
        containsPair('wizard_version', ClubSetupSteps.wizardVersion),
      );
      expect(capture.properties!.containsKey('club_name'), isFalse);
      expect(capture.properties!.containsKey('user_id'), isFalse);
    });

    test('trackStepViewed expose step et step_index', () async {
      analytics.trackStepViewed(ClubSetupSteps.location);
      await flushCaptures();

      expect(
        client.captures.single.eventName,
        ClubSetupAnalytics.stepViewedEvent,
      );
      expect(
        client.captures.single.properties,
        containsPair('step', 'location'),
      );
      expect(
        client.captures.single.properties,
        containsPair('step_index', ClubSetupSteps.location),
      );
    });

    test('trackCompleted trie les objectifs et omet le nom du club', () async {
      analytics.trackCompleted(
        sport: 'Football',
        objectives: {'fees', 'planning', 'parents'},
        memberCountRange: '30_100',
      );
      await flushCaptures();

      final properties = client.captures.single.properties!;
      expect(
        client.captures.single.eventName,
        ClubSetupAnalytics.completedEvent,
      );
      expect(properties['sport'], 'Football');
      expect(properties['objectives'], ['fees', 'parents', 'planning']);
      expect(properties['objective_count'], 3);
      expect(properties['member_count_range'], '30_100');
      expect(properties.containsKey('club_name'), isFalse);
    });

    test('trackCompleted omet member_count_range si vide', () async {
      analytics.trackCompleted(
        sport: 'Tennis',
        objectives: {'planning'},
        memberCountRange: '',
      );
      await flushCaptures();

      expect(
        client.captures.single.properties!.containsKey('member_count_range'),
        isFalse,
      );
    });

    test('ajoute app_env à chaque événement', () async {
      analytics.trackStepViewed(0);
      await flushCaptures();

      expect(
        client.captures.single.properties,
        containsPair('app_env', kReleaseMode ? 'release' : 'debug'),
      );
    });
  });
}
