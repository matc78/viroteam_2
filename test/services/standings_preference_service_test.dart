import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/services/standings_preference_service.dart';

void main() {
  group('StandingsPreferenceService', () {
    test('vide sans consultation enregistrée', () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final lastViewed = StandingsPreferenceService(
        preferences: preferences,
      ).readSync('u1');

      expect(lastViewed.clubId, isNull);
      expect(lastViewed.teamByClub, isEmpty);
    });

    test(
      'write puis readSync restituent les consultations du compte',
      () async {
        SharedPreferences.setMockInitialValues({});
        final preferences = await SharedPreferences.getInstance();
        final service = StandingsPreferenceService(preferences: preferences);

        await service.write(
          'u1',
          const StandingsLastViewed().record('c1', 't1').record('c2', 't2'),
        );

        final lastViewed = service.readSync('u1');
        expect(lastViewed.clubId, 'c2');
        expect(lastViewed.teamId, 't2');
        expect(lastViewed.teamByClub, {'c1': 't1', 'c2': 't2'});
        // Un autre compte sur l'appareil n'en hérite pas.
        expect(service.readSync('u2').clubId, isNull);
      },
    );

    test('valeur illisible : repli sur vide', () async {
      SharedPreferences.setMockInitialValues({
        'standings_last_viewed_v1_u1': 'pas du json',
      });
      final preferences = await SharedPreferences.getInstance();

      expect(
        StandingsPreferenceService(
          preferences: preferences,
        ).readSync('u1').clubId,
        isNull,
      );
    });
  });
}
