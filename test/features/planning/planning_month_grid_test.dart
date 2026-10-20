import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_month_grid.dart';
import 'package:viro_team_v2/models/club_event.dart';

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  testWidgets('annonce les événements du jour et remonte le tap', (
    tester,
  ) async {
    DateTime? tapped;
    final day = DateTime(2026, 10, 14);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PlanningMonthGrid(
            month: DateTime(2026, 10),
            selectedDay: DateTime(2026, 10, 1),
            eventsByDay: {
              day: [
                ClubEvent(
                  id: 'e1',
                  clubId: 'c1',
                  type: EventTypes.other,
                  title: 'Réunion de club',
                  date: day,
                ),
              ],
            },
            onDaySelected: (value) => tapped = value,
          ),
        ),
      ),
    );

    final cell = find.bySemanticsLabel('Mercredi 14 octobre, 1 événement');
    expect(cell, findsOneWidget);
    await tester.tap(cell);
    expect(tapped, day);
  });
}
