import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/models/team_federation.dart';
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

    // Rang 3 et 3 victoires.
    expect(find.text('3'), findsNWidgets(2));
    expect(find.text('USM de Viroflay'), findsOneWidget);
    expect(find.text('7'), findsOneWidget);
    await tester.tap(find.text('USM de Viroflay'));
    expect(tapped, isTrue);
  });
}
