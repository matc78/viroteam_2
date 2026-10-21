import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/home/widgets/planning_day_section_header.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_week_agenda.dart';
import 'package:viro_team_v2/models/club_event.dart';

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  testWidgets(
    'affiche les 7 jours, grise les jours vides et montre les événements',
    (tester) async {
      final weekStart = DateTime(2026, 10, 19); // lundi
      final eventDay = DateTime(2026, 10, 23); // vendredi
      final event = ClubEvent(
        id: 'e1',
        clubId: 'c1',
        type: EventTypes.training,
        title: 'Entraînement',
        date: eventDay,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PlanningWeekAgenda(
              weekStart: weekStart,
              events: [event],
              eventTileBuilder: (e) => Text(e.title),
            ),
          ),
        ),
      );

      expect(find.byType(PlanningDaySectionHeader), findsNWidgets(7));
      expect(find.text(AppCopy.planning.emptyDay), findsNothing);
      expect(find.text('Entraînement'), findsOneWidget);

      final headers = tester
          .widgetList<PlanningDaySectionHeader>(
            find.byType(PlanningDaySectionHeader),
          )
          .toList();
      expect(headers.where((h) => h.muted).length, 6);
      expect(headers.where((h) => !h.muted).length, 1);
      expect(
        headers.singleWhere((h) => !h.muted).day,
        eventDay,
      );
    },
  );
}
