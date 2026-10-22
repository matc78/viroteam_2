import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_logo.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

void main() {
  group('ViroTheme', () {
    test('chaque thème embarque sa palette et sa luminosité', () {
      expect(ViroTheme.light.brightness, Brightness.light);
      expect(ViroTheme.light.extension<ViroPalette>(), ViroPalette.light);
      expect(ViroTheme.dark.brightness, Brightness.dark);
      expect(ViroTheme.dark.extension<ViroPalette>(), ViroPalette.dark);
    });

    test('le texte principal contraste avec le fond en sombre', () {
      final palette = ViroPalette.dark;
      expect(
        palette.textPrimary.computeLuminance(),
        greaterThan(palette.background.computeLuminance() + 0.5),
      );
    });

    test('readableAccent éclaircit une couleur club foncée en sombre', () {
      const nearBlack = Color(0xFF171717);
      expect(ViroPalette.light.readableAccent(nearBlack), nearBlack);
      expect(
        ViroPalette.dark.readableAccent(nearBlack).computeLuminance(),
        greaterThanOrEqualTo(0.16),
      );
    });

    testWidgets('ViroScaffold et ViroCard suivent la palette sombre',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ViroTheme.light,
          darkTheme: ViroTheme.dark,
          themeMode: ThemeMode.dark,
          home: const ViroScaffold(
            body: ViroCard(child: Text('Carte')),
          ),
        ),
      );

      final backgrounds = tester
          .widgetList<ColoredBox>(find.byType(ColoredBox))
          .map((box) => box.color);
      expect(backgrounds, contains(ViroPalette.dark.background));

      final cardMaterial = tester.widget<Material>(
        find
            .ancestor(of: find.text('Carte'), matching: find.byType(Material))
            .first,
      );
      expect(cardMaterial.color, ViroPalette.dark.surfaceCard);
    });

    testWidgets('ViroLogo est teinté en blanc en mode sombre', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ViroTheme.light,
          darkTheme: ViroTheme.dark,
          themeMode: ThemeMode.dark,
          home: const Scaffold(body: Center(child: ViroLogo(height: 48))),
        ),
      );

      final filter = tester.widget<ColorFiltered>(find.byType(ColorFiltered));
      expect(
        filter.colorFilter,
        const ColorFilter.mode(ViroColors.white, BlendMode.srcIn),
      );
    });

    testWidgets('ViroLogoMark reste natif en mode clair', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ViroTheme.light,
          darkTheme: ViroTheme.dark,
          themeMode: ThemeMode.light,
          home: const Scaffold(body: Center(child: ViroLogoMark(height: 32))),
        ),
      );

      expect(find.byType(ColorFiltered), findsNothing);
      expect(find.byType(Image), findsOneWidget);
    });
  });
}
