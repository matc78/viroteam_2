import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/services/haptics_preference_service.dart';

void main() {
  group('HapticsPreferenceService', () {
    test('activé par défaut sans choix enregistré', () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final service = HapticsPreferenceService(preferences: preferences);

      expect(service.readSync(), isTrue);
    });

    test('write puis readSync restituent le choix', () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final service = HapticsPreferenceService(preferences: preferences);

      await service.write(false);

      expect(service.readSync(), isFalse);
      expect(
        HapticsPreferenceService(preferences: preferences).readSync(),
        isFalse,
      );
    });

    test('readSync sans préférences préchargées retourne true', () {
      expect(HapticsPreferenceService().readSync(), isTrue);
    });
  });
}
