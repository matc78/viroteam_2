import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/features/settings/providers/analytics_consent_provider.dart';
import 'package:viro_team_v2/features/settings/widgets/analytics_consent_sheet.dart';
import 'package:viro_team_v2/features/settings/widgets/analytics_settings_section.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/analytics_consent_service.dart';
import 'package:viro_team_v2/services/analytics_service.dart';

import '../../helpers/recording_analytics_client.dart';

void main() {
  late SharedPreferences preferences;
  late RecordingAnalyticsClient client;
  late ProviderContainer container;

  Future<void> createContainer(Map<String, Object> initialPrefs) async {
    SharedPreferences.setMockInitialValues(initialPrefs);
    preferences = await SharedPreferences.getInstance();
    client = RecordingAnalyticsClient();
    final analytics = AnalyticsService(client: client, apiKey: 'phc_test');
    await analytics.start(consented: false);
    container = ProviderContainer(
      overrides: [
        analyticsConsentServiceProvider.overrideWithValue(
          AnalyticsConsentService(preferences: preferences),
        ),
        analyticsServiceProvider.overrideWithValue(analytics),
      ],
    );
  }

  tearDown(() => container.dispose());

  Widget app(Widget body) => UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: ViroTheme.light,
          home: Scaffold(body: body),
        ),
      );

  group('AnalyticsSettingsSection', () {
    testWidgets('désactivé par défaut, activation persistée', (tester) async {
      await createContainer({});
      await tester.pumpWidget(
        app(const SingleChildScrollView(child: AnalyticsSettingsSection())),
      );

      expect(find.text('Mesure d’audience'), findsOneWidget);
      expect(container.read(analyticsConsentProvider), AnalyticsConsent.unknown);

      await tester.tap(find.text('Statistiques d’usage'));
      await tester.pumpAndSettle();

      expect(container.read(analyticsConsentProvider), AnalyticsConsent.granted);
      expect(preferences.getString('analytics_consent_v1'), 'granted');
      expect(client.enabled, isTrue);
    });
  });

  group('maybeShowAnalyticsConsent', () {
    Widget launcher() => Consumer(
          builder: (context, ref, _) => TextButton(
            onPressed: () => maybeShowAnalyticsConsent(context, ref),
            child: const Text('ouvrir'),
          ),
        );

    testWidgets('« Non merci » enregistre le refus', (tester) async {
      await createContainer({});
      await tester.pumpWidget(app(launcher()));

      await tester.tap(find.text('ouvrir'));
      await tester.pumpAndSettle();
      expect(find.text('Tu nous files un coup de main ?'), findsOneWidget);

      await tester.tap(find.text('Non merci'));
      await tester.pumpAndSettle();

      expect(container.read(analyticsConsentProvider), AnalyticsConsent.denied);
      expect(preferences.getString('analytics_consent_v1'), 'denied');
      expect(client.enabled, isFalse);
    });

    testWidgets('ne redemande pas une fois le choix fait', (tester) async {
      await createContainer({'analytics_consent_v1': 'granted'});
      await tester.pumpWidget(app(launcher()));

      await tester.tap(find.text('ouvrir'));
      await tester.pumpAndSettle();

      expect(find.text('Tu nous files un coup de main ?'), findsNothing);
    });
  });
}
