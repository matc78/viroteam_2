import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/services/theme_preference_service.dart';

void main() {
  group('ThemePreferenceService', () {
    test('retourne ThemeMode.system sans choix enregistré', () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final service = ThemePreferenceService(preferences: preferences);

      expect(service.readSync(), ThemeMode.system);
      expect(await service.read(), ThemeMode.system);
    });

    test('write puis read restituent le mode choisi', () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final service = ThemePreferenceService(preferences: preferences);

      await service.write(ThemeMode.dark);

      expect(service.readSync(), ThemeMode.dark);
      expect(
        await ThemePreferenceService(preferences: preferences).read(),
        ThemeMode.dark,
      );
    });

    test('une valeur inconnue retombe sur ThemeMode.system', () async {
      SharedPreferences.setMockInitialValues({'app_theme_mode_v1': 'sepia'});
      final preferences = await SharedPreferences.getInstance();
      final service = ThemePreferenceService(preferences: preferences);

      expect(service.readSync(), ThemeMode.system);
    });

    test('readSync sans préférences préchargées retourne system', () {
      expect(ThemePreferenceService().readSync(), ThemeMode.system);
    });
  });
}
