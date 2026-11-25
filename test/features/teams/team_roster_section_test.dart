import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/teams/widgets/team_roster_section.dart';

void main() {
  Future<void> pump(WidgetTester tester, TeamRosterSection section) =>
      tester.pumpWidget(MaterialApp(home: Scaffold(body: section)));

  testWidgets('TeamRosterSection : titre avec compteur et lignes', (
    tester,
  ) async {
    await pump(
      tester,
      const TeamRosterSection(
        title: 'Joueurs',
        titleColor: Colors.indigo,
        children: [Text('Léa'), Text('Paul')],
      ),
    );

    expect(find.text('JOUEURS · 2'), findsOneWidget);
    expect(find.text('Léa'), findsOneWidget);
    expect(find.text(AppCopy.teams.addShort), findsNothing);
  });

  testWidgets('TeamRosterSection : état vide et bouton Ajouter', (
    tester,
  ) async {
    var added = false;
    await pump(
      tester,
      TeamRosterSection(
        title: 'Coachs',
        titleColor: Colors.indigo,
        onAdd: () => added = true,
        children: const [],
      ),
    );

    expect(find.text(AppCopy.teams.noMembers), findsOneWidget);
    await tester.tap(find.text(AppCopy.teams.addShort));
    expect(added, isTrue);
  });

  testWidgets('TeamRosterSection : masquée si vide et showWhenEmpty false', (
    tester,
  ) async {
    await pump(
      tester,
      const TeamRosterSection(
        title: 'En attente',
        titleColor: Colors.grey,
        showWhenEmpty: false,
        children: [],
      ),
    );

    expect(find.text('EN ATTENTE · 0'), findsNothing);
  });
}
