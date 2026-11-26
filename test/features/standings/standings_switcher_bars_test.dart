import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/features/standings/widgets/standings_switcher_bars.dart';

Widget _wrap(Widget child) => MaterialApp(
  theme: ViroTheme.light,
  home: Scaffold(body: child),
);

StandingsSwitcherOption _option(
  String label, {
  bool selected = false,
  int? rank,
  String? detail,
  VoidCallback? onTap,
}) => StandingsSwitcherOption(
  label: label,
  detail: detail,
  color: Colors.indigo,
  selected: selected,
  rank: rank,
  semanticLabel: label,
  onTap: onTap ?? () {},
);

void main() {
  testWidgets('segments : libellé, enfants, badge de rang et tap', (
    tester,
  ) async {
    var tapped = '';
    await tester.pumpWidget(
      _wrap(
        StandingsTeamSegments(
          options: [
            _option('Seniors F', selected: true, rank: 3),
            _option('M13', detail: 'Léo', rank: 1, onTap: () => tapped = 'M13'),
          ],
        ),
      ),
    );

    expect(find.textContaining('Léo'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('1'), findsOneWidget);
    // Tient dans la largeur : pas de défilement.
    expect(find.byType(SingleChildScrollView), findsNothing);

    await tester.tap(find.textContaining('M13'));
    expect(tapped, 'M13');
    tapped = '';
    await tester.tap(find.text('Seniors F'));
    expect(tapped, isEmpty);
  });

  testWidgets('onglets de club trop larges : défilent sans déborder', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      _wrap(
        StandingsClubTabs(
          options: [
            _option('Volley Club de Lyon', selected: true),
            _option('AS Villeurbanne Volley'),
            _option('Bron Volley', detail: 'Léo, Emma'),
          ],
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    expect(find.byType(SingleChildScrollView), findsOneWidget);
  });
  testWidgets('segments d’équipe trop larges : défilent sans planter', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      _wrap(
        StandingsTeamSegments(
          options: [
            _option('Seniors Masculins Régionale', selected: true, rank: 2),
            _option('Seniors Féminines Pré-nationale', rank: 5),
            _option('M18 Garçons Départementale', rank: 11),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(SingleChildScrollView), findsOneWidget);
    expect(find.text('Seniors Masculins Régionale'), findsOneWidget);
  });
}
