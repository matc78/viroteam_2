import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';
import 'package:viro_team_v2/widgets/lists/pool_match_list_tile.dart';

Future<void> _pump(WidgetTester tester, PoolTeamMatch match) {
  return tester.pumpWidget(
    MaterialApp(
      theme: ViroTheme.light,
      home: Scaffold(body: PoolMatchListTile(match: match)),
    ),
  );
}

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  testWidgets('PoolMatchListTile : match joué avec score et sets, sans salle', (
    tester,
  ) async {
    await _pump(
      tester,
      PoolTeamMatch(
        code: '1MBA005',
        round: 2,
        date: DateTime(2026, 10, 11),
        time: '15:00',
        isHome: false,
        opponentKey: 'usm-de-viroflay',
        opponentName: 'USM DE VIROFLAY',
        venue: 'GAILLON',
        us: 2,
        them: 3,
        sets: const ['25-22', '25-27'],
      ),
    );

    expect(find.text('J2'), findsOneWidget);
    expect(find.text('11/10'), findsOneWidget);
    expect(find.text('USM de Viroflay'), findsOneWidget);
    expect(find.text('Extérieur'), findsOneWidget);
    expect(find.text('2-3'), findsOneWidget);
    expect(find.text('25-22'), findsOneWidget);
    expect(find.text('25-27'), findsOneWidget);
    expect(find.textContaining('Gaillon'), findsNothing);
  });

  testWidgets('PoolMatchListTile : match à venir avec heure, sans salle', (
    tester,
  ) async {
    await _pump(
      tester,
      PoolTeamMatch(
        code: '1MBA017',
        round: 5,
        date: DateTime(2026, 11, 29),
        time: '15:00',
        isHome: true,
        opponentKey: 'bois',
        opponentName: "VOLLEY-BALL BOIS D'ARCY 2",
        venue: 'GYMNASE DU CHAMP DES OISEAUX',
      ),
    );

    expect(find.text("Volley-Ball Bois d'Arcy 2"), findsOneWidget);
    expect(find.text('Domicile'), findsOneWidget);
    expect(find.text('15:00'), findsOneWidget);
    expect(find.textContaining('Champ des Oiseaux'), findsNothing);
  });
}
