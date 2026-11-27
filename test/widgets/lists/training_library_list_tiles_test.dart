import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/services/training/training_library.dart';
import 'package:viro_team_v2/widgets/lists/training_library_drill_list_tile.dart';
import 'package:viro_team_v2/widgets/lists/training_library_session_list_tile.dart';

final _session = TrainingLibrarySession(
  event: ClubEvent(
    id: 'e1',
    clubId: 'c',
    type: EventTypes.training,
    title: 'Entraînement',
    date: DateTime(2026, 11, 20),
  ),
  coachUid: 'coach',
  coachName: 'Léa',
  notes: '',
  drills: const [
    TrainingDrill(id: 'd1', title: 'Échauffement', durationMin: 10),
    TrainingDrill(id: 'd2', durationMin: 20),
  ],
);

Widget _wrap(Widget child) => MaterialApp(
  theme: ViroTheme.light,
  home: Scaffold(body: child),
);

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  testWidgets('TrainingLibrarySessionListTile : résumé et actions', (
    tester,
  ) async {
    var opened = false;
    var duplicated = false;
    await tester.pumpWidget(
      _wrap(
        TrainingLibrarySessionListTile(
          session: _session,
          teamsLabel: 'M18',
          onOpen: () => opened = true,
          onDuplicate: () => duplicated = true,
        ),
      ),
    );
    expect(
      find.text(AppCopy.training.librarySessionMeta('Léa', 2, 30)),
      findsOneWidget,
    );
    expect(find.text('Échauffement → Exo 2'), findsOneWidget);
    await tester.tap(find.text(AppCopy.training.libraryOpenSession));
    await tester.tap(find.text(AppCopy.training.libraryDuplicate));
    expect(opened, isTrue);
    expect(duplicated, isTrue);
  });

  testWidgets('TrainingLibrarySessionListTile : état dupliquée', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        TrainingLibrarySessionListTile(
          session: _session,
          teamsLabel: '',
          onOpen: () {},
          onDuplicate: () {},
          duplicated: true,
        ),
      ),
    );
    expect(find.text(AppCopy.training.libraryDuplicated), findsOneWidget);
    expect(
      find.textContaining(AppCopy.training.libraryDefaultTeams),
      findsOneWidget,
    );
  });

  testWidgets('TrainingLibraryDrillListTile : ajoute puis « Ajouté »', (
    tester,
  ) async {
    var added = false;
    final row = TrainingLibraryDrillRow(
      key: 'e1:coach:d1',
      drill: _session.drills.first,
      session: _session,
    );
    await tester.pumpWidget(
      _wrap(TrainingLibraryDrillListTile(row: row, onAdd: () => added = true)),
    );
    expect(find.textContaining('Échauffement'), findsOneWidget);
    await tester.tap(find.text(AppCopy.training.libraryAddDrill));
    expect(added, isTrue);

    await tester.pumpWidget(
      _wrap(TrainingLibraryDrillListTile(row: row, onAdd: () {}, added: true)),
    );
    expect(find.text(AppCopy.training.libraryDrillAdded), findsOneWidget);
  });
}
