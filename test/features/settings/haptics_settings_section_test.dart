import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/features/settings/providers/haptics_enabled_provider.dart';
import 'package:viro_team_v2/features/settings/widgets/haptics_settings_section.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/haptics_preference_service.dart';

void main() {
  group('HapticsSettingsSection', () {
    late SharedPreferences preferences;
    late ProviderContainer container;

    setUp(() async {
      ViroHaptics.resetForTest();
      SharedPreferences.setMockInitialValues({});
      preferences = await SharedPreferences.getInstance();
      container = ProviderContainer(
        overrides: [
          hapticsPreferenceServiceProvider.overrideWithValue(
            HapticsPreferenceService(preferences: preferences),
          ),
        ],
      );
    });

    tearDown(() {
      container.dispose();
      ViroHaptics.resetForTest();
    });

    Future<void> pumpSection(WidgetTester tester) {
      return tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: ViroTheme.light,
            home: const Scaffold(
              body: SingleChildScrollView(child: HapticsSettingsSection()),
            ),
          ),
        ),
      );
    }

    testWidgets('activé par défaut', (tester) async {
      await pumpSection(tester);

      expect(find.text('Vibrations'), findsOneWidget);
      expect(container.read(hapticsEnabledProvider), isTrue);
      expect(ViroHaptics.enabled, isTrue);
    });

    testWidgets('couper le toggle persiste le choix et coupe ViroHaptics',
        (tester) async {
      await pumpSection(tester);

      await tester.tap(find.text('Vibrations'));
      await tester.pumpAndSettle();

      expect(container.read(hapticsEnabledProvider), isFalse);
      expect(ViroHaptics.enabled, isFalse);
      expect(preferences.getBool('app_haptics_enabled_v1'), isFalse);
    });

    testWidgets('un choix enregistré « coupé » est relu au démarrage',
        (tester) async {
      await preferences.setBool('app_haptics_enabled_v1', false);

      await pumpSection(tester);

      expect(container.read(hapticsEnabledProvider), isFalse);
      expect(ViroHaptics.enabled, isFalse);
    });
  });
}
