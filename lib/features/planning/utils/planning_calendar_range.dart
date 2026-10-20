import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/utils/calendar_days.dart';

/// Mode d'affichage du planning club.
enum PlanningViewMode { day, week, month }

/// Minuit local du jour de [date].
DateTime planningDateOnly(DateTime date) =>
    DateTime(date.year, date.month, date.day);

/// Lundi (minuit local) de la semaine contenant [date].
DateTime planningStartOfWeek(DateTime date) {
  final day = planningDateOnly(date);
  return addCalendarDays(day, -(day.weekday - DateTime.monday));
}

/// Jours affichés dans la grille du mois de [month] : du lundi précédant le 1er
/// au dimanche suivant le dernier jour (semaines complètes, 4 à 6 lignes).
List<DateTime> planningMonthGridDays(DateTime month) {
  final first = DateTime(month.year, month.month);
  final last = DateTime(month.year, month.month + 1, 0);
  final gridStart = planningStartOfWeek(first);
  final gridEnd = addCalendarDays(planningStartOfWeek(last), 7);
  final total = calendarDaysBetween(gridStart, gridEnd);
  return List.generate(total, (index) => addCalendarDays(gridStart, index));
}

/// Période chargée pour [mode] autour de [anchor] : début inclus, fin exclue.
///
/// Le mode mois couvre toute la grille (jours débordants inclus) pour que
/// les pastilles des semaines partielles soient justes.
({DateTime start, DateTime endExclusive}) planningPeriodRange(
  PlanningViewMode mode,
  DateTime anchor,
) {
  switch (mode) {
    case PlanningViewMode.day:
      final day = planningDateOnly(anchor);
      return (start: day, endExclusive: addCalendarDays(day, 1));
    case PlanningViewMode.week:
      final start = planningStartOfWeek(anchor);
      return (start: start, endExclusive: addCalendarDays(start, 7));
    case PlanningViewMode.month:
      final days = planningMonthGridDays(anchor);
      return (start: days.first, endExclusive: addCalendarDays(days.last, 1));
  }
}

/// Décale [anchor] d'une période (± [delta]) selon [mode].
///
/// En mode mois, le jour est ramené au dernier jour du mois cible si besoin
/// (31 janvier + 1 mois → 28/29 février).
DateTime shiftPlanningAnchor(
  PlanningViewMode mode,
  DateTime anchor,
  int delta,
) {
  final day = planningDateOnly(anchor);
  switch (mode) {
    case PlanningViewMode.day:
      return addCalendarDays(day, delta);
    case PlanningViewMode.week:
      return addCalendarDays(day, 7 * delta);
    case PlanningViewMode.month:
      final lastDayOfTarget = DateTime(day.year, day.month + delta + 1, 0).day;
      return DateTime(
        day.year,
        day.month + delta,
        day.day > lastDayOfTarget ? lastDayOfTarget : day.day,
      );
  }
}

/// Regroupe [events] par jour calendaire local, jours et événements triés.
Map<DateTime, List<ClubEvent>> groupPlanningEventsByDay(
  Iterable<ClubEvent> events,
) {
  final sorted = events.toList()..sort((a, b) => a.date.compareTo(b.date));
  final byDay = <DateTime, List<ClubEvent>>{};
  for (final event in sorted) {
    byDay.putIfAbsent(planningDateOnly(event.date), () => []).add(event);
  }
  return byDay;
}
