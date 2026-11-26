import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/widgets/common/viro_rank_badge.dart';
import 'package:viro_team_v2/widgets/lists/team_standing_list_tile.dart';

void main() {
  testWidgets('TeamStandingListTile affiche rang, nom lisible et stats', (
    tester,
  ) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: TeamStandingListTile(
            row: const PoolStandingRow(
              key: 'usm-de-viroflay',
              rank: 3,
              name: 'USM DE VIROFLAY',
              points: 7,
              played: 4,
              won: 3,
              lost: 1,
            ),
            isMyTeam: true,
            accentColor: Colors.deepOrange,
            onTap: () => tapped = true,
          ),
        ),
      ),
    );

    // Rang 3 (médaille de bronze) et 3 victoires.
    expect(find.text('3'), findsNWidgets(2));
    expect(find.byType(ViroRankBadge), findsOneWidget);
    expect(find.text('USM de Viroflay'), findsOneWidget);
    expect(find.text('7'), findsOneWidget);
    await tester.pumpAndSettle();
    await tester.tap(find.text('USM de Viroflay'));
    expect(tapped, isTrue);
  });

  testWidgets('entrée en cascade : la ligne apparaît puis reste visible', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: const Scaffold(
          body: TeamStandingListTile(
            row: PoolStandingRow(key: 'k', rank: 7, name: 'EQUIPE'),
            isMyTeam: false,
            accentColor: Colors.deepOrange,
            entranceIndex: 5,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final opacity = tester.widget<Opacity>(
      find.ancestor(of: find.text('Equipe'), matching: find.byType(Opacity)),
    );
    expect(opacity.opacity, 1);
  });

  testWidgets('ligne reconstruite après l’entrée : visible d’emblée', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: const Scaffold(
          body: TeamStandingListTile(
            row: PoolStandingRow(key: 'k', rank: 1, name: 'EQUIPE'),
            isMyTeam: false,
            accentColor: Colors.deepOrange,
            entranceIndex: 12,
            animateEntrance: false,
          ),
        ),
      ),
    );
    final opacity = tester.widget<Opacity>(
      find.ancestor(of: find.text('Equipe'), matching: find.byType(Opacity)),
    );
    expect(opacity.opacity, 1);
    // Pas d'éclat de médaille rejoué : rien ne reste à animer.
    expect(tester.hasRunningAnimations, isFalse);
  });
}
