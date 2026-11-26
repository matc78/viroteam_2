import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_rank_badge.dart';

void main() {
  test('rankBadgeColor : podium, chocolat puis couleur du club', () {
    const club = Colors.deepPurple;
    expect(rankBadgeColor(1, club), ViroColors.rankGold);
    expect(rankBadgeColor(2, club), ViroColors.rankSilver);
    expect(rankBadgeColor(3, club), ViroColors.rankBronze);
    expect(rankBadgeColor(4, club), ViroColors.rankChocolate);
    expect(rankBadgeColor(5, club), club);
    expect(rankBadgeColor(12, club), club);
  });

  test('rankRowBackground : fond opaque sur les 4 premières places', () {
    const palette = ViroPalette.light;
    for (final rank in [1, 2, 3, 4]) {
      final background = rankRowBackground(rank, palette)!;
      expect(background.a, 1);
      expect(background, isNot(palette.surfaceCard));
    }
    expect(rankRowBackground(5, palette), isNull);
    expect(rankRowBackground(0, palette), isNull);
  });

  testWidgets('ViroRankBadge affiche la position', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: const Scaffold(
          body: ViroRankBadge(rank: 2, clubColor: Colors.teal),
        ),
      ),
    );
    expect(find.text('2'), findsOneWidget);
  });
}
