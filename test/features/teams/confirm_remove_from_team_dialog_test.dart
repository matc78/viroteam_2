import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/teams/widgets/confirm_remove_from_team_dialog.dart';

void main() {
  Future<List<bool>> openAndAnswer(
    WidgetTester tester, {
    required String buttonLabel,
  }) async {
    final results = <bool>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                results.add(
                  await showConfirmRemoveFromTeamDialog(
                    context,
                    memberName: 'Jean Dupont',
                    teamName: 'U13 A',
                  ),
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text(AppCopy.teams.removeFromTeamTitle), findsOneWidget);
    expect(
      find.text(
        AppCopy.teams.removeFromTeamBody(
          memberName: 'Jean Dupont',
          teamName: 'U13 A',
        ),
      ),
      findsOneWidget,
    );

    await tester.tap(find.text(buttonLabel));
    await tester.pumpAndSettle();
    return results;
  }

  testWidgets('confirmer retourne true', (tester) async {
    final results = await openAndAnswer(
      tester,
      buttonLabel: AppCopy.teams.removeFromTeamAction,
    );
    expect(results, [true]);
  });

  testWidgets('annuler retourne false', (tester) async {
    final results = await openAndAnswer(
      tester,
      buttonLabel: AppCopy.common.cancel,
    );
    expect(results, [false]);
  });

  test('résumé de roster : en attente masqué si 0, pluriels', () {
    expect(
      AppCopy.teams.rosterSummary(players: 1, coaches: 0, pending: 0),
      '1 joueur · 0 coach',
    );
    expect(
      AppCopy.teams.rosterSummary(players: 12, coaches: 2, pending: 3),
      '12 joueurs · 2 coachs · 3 en attente',
    );
  });
}
