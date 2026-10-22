import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/features/settings/providers/theme_mode_provider.dart';
import 'package:viro_team_v2/features/settings/widgets/appearance_settings_section.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/theme_preference_service.dart';

void main() {
  group('AppearanceSettingsSection', () {
    late SharedPreferences preferences;
    late ProviderContainer container;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      preferences = await SharedPreferences.getInstance();
      container = ProviderContainer(
        overrides: [
          themePreferenceServiceProvider.overrideWithValue(
            ThemePreferenceService(preferences: preferences),
          ),
        ],
      );
    });

    tearDown(() => container.dispose());

    Future<void> pumpSection(WidgetTester tester) {
      return tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: ViroTheme.light,
            darkTheme: ViroTheme.dark,
            home: const Scaffold(
              body: SingleChildScrollView(child: AppearanceSettingsSection()),
            ),
          ),
        ),
      );
    }

    testWidgets('affiche les trois choix, Système par défaut', (tester) async {
      await pumpSection(tester);

      expect(find.text('Apparence'), findsOneWidget);
      expect(find.text('Comme ton téléphone'), findsOneWidget);
      expect(find.text('Clair'), findsOneWidget);
      expect(find.text('Sombre'), findsOneWidget);
      expect(container.read(themeModeProvider), ThemeMode.system);
    });

    testWidgets('tap sur Sombre met à jour et persiste le thème',
        (tester) async {
      await pumpSection(tester);

      await tester.tap(find.text('Sombre'));
      await tester.pumpAndSettle();

      expect(container.read(themeModeProvider), ThemeMode.dark);
      expect(preferences.getString('app_theme_mode_v1'), 'dark');
    });
  });
}
