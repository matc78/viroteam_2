import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/features/planning/utils/planning_calendar_range.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';

ClubEvent _event(String id, DateTime date) => ClubEvent(
  id: id,
  clubId: 'c1',
  type: EventTypes.training,
  title: '',
  date: date,
);

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  group('planningStartOfWeek', () {
    test('ramène au lundi minuit', () {
      expect(
        planningStartOfWeek(DateTime(2026, 10, 22, 18, 30)),
        DateTime(2026, 10, 19),
      );
    });

    test('un dimanche appartient à la semaine du lundi précédent', () {
      expect(
        planningStartOfWeek(DateTime(2026, 10, 25)),
        DateTime(2026, 10, 19),
      );
    });

    test('un lundi reste sur lui-même', () {
      expect(
        planningStartOfWeek(DateTime(2026, 10, 19)),
        DateTime(2026, 10, 19),
      );
    });
  });

  group('planningMonthGridDays', () {
    test('couvre des semaines complètes du lundi au dimanche', () {
      final days = planningMonthGridDays(DateTime(2026, 10, 20));
      expect(days.first, DateTime(2026, 9, 28));
      expect(days.last, DateTime(2026, 11, 1));
      expect(days.length % 7, 0);
      expect(days.length, 35);
    });

    test('traverse le passage à l’heure d’hiver sans doublon', () {
      final days = planningMonthGridDays(DateTime(2026, 10, 1));
      expect(days.toSet().length, days.length);
      expect(days.every((d) => d.hour == 0), isTrue);
    });
  });

  group('planningPeriodRange', () {
    test('semaine : lundi inclus, lundi suivant exclu', () {
      final range = planningPeriodRange(
        PlanningViewMode.week,
        DateTime(2026, 10, 22),
      );
      expect(range.start, DateTime(2026, 10, 19));
      expect(range.endExclusive, DateTime(2026, 10, 26));
    });

    test('mois : toute la grille', () {
      final range = planningPeriodRange(
        PlanningViewMode.month,
        DateTime(2026, 10, 20),
      );
      expect(range.start, DateTime(2026, 9, 28));
      expect(range.endExclusive, DateTime(2026, 11, 2));
    });
  });

  group('shiftPlanningAnchor', () {
    test('semaine : ± 7 jours', () {
      expect(
        shiftPlanningAnchor(PlanningViewMode.week, DateTime(2026, 10, 20), 1),
        DateTime(2026, 10, 27),
      );
    });

    test('mois : borne au dernier jour du mois cible', () {
      expect(
        shiftPlanningAnchor(PlanningViewMode.month, DateTime(2026, 1, 31), 1),
        DateTime(2026, 2, 28),
      );
      expect(
        shiftPlanningAnchor(PlanningViewMode.month, DateTime(2026, 1, 15), -1),
        DateTime(2025, 12, 15),
      );
    });
  });

  test('groupPlanningEventsByDay regroupe et trie par jour', () {
    final grouped = groupPlanningEventsByDay([
      _event('b', DateTime(2026, 10, 21, 18)),
      _event('a', DateTime(2026, 10, 20, 10)),
      _event('c', DateTime(2026, 10, 21, 9)),
    ]);
    expect(grouped.keys, [DateTime(2026, 10, 20), DateTime(2026, 10, 21)]);
    expect(grouped[DateTime(2026, 10, 21)]!.map((e) => e.id), ['c', 'b']);
  });

  group('libellés de période', () {
    test('mois capitalisé', () {
      expect(formatPlanningMonth(DateTime(2026, 10, 1)), 'Octobre 2026');
    });

    test('semaine à cheval sur deux mois', () {
      final label = formatPlanningWeekRange(DateTime(2026, 10, 26));
      expect(label, startsWith('26 oct. – 1 nov.'));
    });

    test('semaine dans un même mois', () {
      final label = formatPlanningWeekRange(DateTime(2026, 10, 19));
      expect(label, startsWith('19 – 25 octobre'));
    });
  });
}
