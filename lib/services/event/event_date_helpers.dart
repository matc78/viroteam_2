import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_event.dart';

/// Helpers calendaires et tri pour le planning événements.
class EventDateHelpers {
  EventDateHelpers._();

  /// Minuit local d'aujourd'hui.
  static DateTime startOfToday() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  /// Minuit local du jour [d].
  static DateTime startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

  /// Même jour calendaire (fuseau local).
  static bool sameCalendarDay(DateTime a, DateTime b) {
    final dayA = startOfDay(a);
    final dayB = startOfDay(b);
    return dayA.year == dayB.year &&
        dayA.month == dayB.month &&
        dayA.day == dayB.day;
  }

  /// Identifiant jour `yyyyMMdd` (local).
  static String dateIdFor(DateTime day) {
    final d = startOfDay(day);
    final m = d.month.toString().padLeft(2, '0');
    final dayStr = d.day.toString().padLeft(2, '0');
    return '${d.year}$m$dayStr';
  }

  /// Borne basse Firestore : inclut les événements « minuit local » stockés en UTC.
  static Timestamp get upcomingQueryLowerBound => Timestamp.fromDate(
        startOfToday().subtract(const Duration(days: 1)),
      );

  /// Fenêtre « Planning à venir » : 14 jours calendaires à partir d'aujourd'hui.
  static const int upcomingPlanningHorizonDays = 14;

  /// Indique si [eventDate] est dans la fenêtre planning à venir.
  static bool isWithinUpcomingPlanningWindow(DateTime eventDate) {
    final start = startOfToday();
    final endExclusive =
        start.add(const Duration(days: upcomingPlanningHorizonDays));
    final day = startOfDay(eventDate);
    return !day.isBefore(start) && day.isBefore(endExclusive);
  }

  /// Filtre non annulés dans la fenêtre planning à venir.
  static List<ClubEvent> filterUpcomingWindow(Iterable<ClubEvent> events) =>
      events
          .where(
            (e) => !e.canceled && isWithinUpcomingPlanningWindow(e.date),
          )
          .toList();

  /// Comparaison chronologique (date croissante).
  static int compareByDate(ClubEvent a, ClubEvent b) =>
      a.date.compareTo(b.date);

  /// Copie triée par date croissante.
  static List<ClubEvent> sortedByDate(Iterable<ClubEvent> events) {
    final list = events.toList();
    list.sort(compareByDate);
    return list;
  }

  /// Déduplique par `clubId_id` puis trie par date.
  static List<ClubEvent> dedupeEvents(List<ClubEvent> events) {
    final byKey = <String, ClubEvent>{};
    for (final event in events) {
      byKey['${event.clubId}_${event.id}'] = event;
    }
    return sortedByDate(byKey.values);
  }

  /// Jour calendaire d'un doc événement, ou null si ni [dateId] ni [date].
  static DateTime? calendarDateFromEventData(Map<String, dynamic> data) {
    final dateId = data[FirestoreFields.dateId] as String?;
    final hasDateId =
        dateId != null && RegExp(r'^\d{8}$').hasMatch(dateId);
    if (!hasDateId && data[FirestoreFields.date] == null) return null;
    return ClubEvent.calendarDateFromFirestore(data);
  }
}
