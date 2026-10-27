import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/providers/planning_providers.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_form_controller.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_save_bar.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';

ClubEvent _event(String id, DateTime date) => ClubEvent(
      id: id,
      clubId: 'c1',
      type: EventTypes.training,
      title: id,
      date: date,
    );

void main() {
  const club = Club(id: 'c1', name: 'Club', sport: 'football');

  group('AddEventFormController.blockingReason', () {
    test('sans équipe : raison « Choisis une équipe », Créer désactivé', () {
      final form = AddEventFormController(initialDate: DateTime(2026, 10, 23));
      expect(form.blockingReason(club), AppCopy.planning.chooseTeamSnack);
      expect(form.canCreate(club), isFalse);
    });

    test('formulaire complet : aucune raison', () {
      final form = AddEventFormController(initialDate: DateTime(2026, 10, 23))
        ..setTeamId('u13')
        ..locationController.text = 'Stade';
      expect(form.blockingReason(club), isNull);
      expect(form.canCreate(club), isTrue);
    });
  });

  group('AddEventFormController.hasUserEdits', () {
    test('préremplissages seuls : pas de confirmation', () {
      final form = AddEventFormController(initialDate: DateTime(2026, 10, 23))
        ..ensureDefaultTeam([]);
      expect(form.hasUserEdits, isFalse);
    });

    test('choix ou saisie du coach : formulaire modifié', () {
      final byChoice = AddEventFormController()
        ..setDate(DateTime(2026, 11, 2));
      expect(byChoice.hasUserEdits, isTrue);

      final byText = AddEventFormController()..titleController.text = 'Repas';
      expect(byText.hasUserEdits, isTrue);
    });
  });

  test('nextPlanningEventDay : premier jour strictement après', () {
    final events = [
      _event('passe', DateTime(2026, 10, 20, 18)),
      _event('meme-jour', DateTime(2026, 10, 23, 20)),
      _event('loin', DateTime(2026, 10, 30, 9)),
      _event('proche', DateTime(2026, 10, 25, 10)),
    ];
    expect(
      nextPlanningEventDay(events, after: DateTime(2026, 10, 23, 8)),
      DateTime(2026, 10, 25),
    );
    expect(
      nextPlanningEventDay(events, after: DateTime(2026, 10, 30)),
      isNull,
    );
  });

  testWidgets('AddEventSaveBar affiche la raison quand Créer est bloqué',
      (tester) async {
    Widget bar({required bool canSubmit}) => MaterialApp(
          home: Scaffold(
            body: AddEventSaveBar(
              isRecurringSeries: false,
              isLoading: false,
              canSubmit: canSubmit,
              blockingReason:
                  canSubmit ? null : AppCopy.planning.chooseTeamSnack,
              onSubmit: () {},
            ),
          ),
        );

    await tester.pumpWidget(bar(canSubmit: false));
    expect(find.text(AppCopy.planning.chooseTeamSnack), findsOneWidget);

    await tester.pumpWidget(bar(canSubmit: true));
    expect(find.text(AppCopy.planning.chooseTeamSnack), findsNothing);
  });
}
