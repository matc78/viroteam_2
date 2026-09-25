import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';
import 'package:viro_team_v2/services/event/event_paths.dart';
import 'package:viro_team_v2/services/event/event_upcoming_queries.dart';

/// Requêtes planning jour, dates bornes et highlights club / parent.
class EventDayQueries {
  /// Crée le module planning jour / highlights.
  EventDayQueries({
    required EventPaths paths,
    required EventUpcomingQueries upcoming,
  })  : _paths = paths,
        _upcoming = upcoming;

  final EventPaths _paths;
  final EventUpcomingQueries _upcoming;

  /// Tous les événements d'un jour (vue planning club).
  Stream<List<ClubEvent>> watchClubEventsOnDay({
    required String clubId,
    required DateTime day,
  }) {
    final dayStart = EventDateHelpers.startOfDay(day);
    // Fenêtre élargie + filtre calendaire : évite les ratés timezone / Timestamp.
    final queryFrom = dayStart.subtract(const Duration(hours: 14));
    final queryTo = dayStart.add(const Duration(days: 1, hours: 14));

    return _paths
        .events(clubId)
        .where(
          FirestoreFields.date,
          isGreaterThanOrEqualTo: Timestamp.fromDate(queryFrom),
        )
        .where(
          FirestoreFields.date,
          isLessThan: Timestamp.fromDate(queryTo),
        )
        .orderBy(FirestoreFields.date)
        .snapshots()
        .map(
          (snap) => EventDateHelpers.sortedByDate(
            snap.docs
                .map((d) => ClubEvent.fromFirestore(clubId: clubId, doc: d))
                .where(
                  (e) =>
                      !e.canceled &&
                      EventDateHelpers.sameCalendarDay(e.date, day),
                ),
          ),
        );
  }

  /// Événements d'un jour pour un membre (mêmes sources que l'accueil joueur).
  Stream<List<ClubEvent>> watchMemberEventsOnDay({
    required String clubId,
    required DateTime day,
    required String audienceId,
    required String authUid,
  }) {
    return _upcoming
        .watchUpcomingEventsForClubMember(
          clubId: clubId,
          audienceId: audienceId,
          authUid: authUid,
        )
        .map(
          (events) => EventDateHelpers.sortedByDate(
            events.where(
              (e) => EventDateHelpers.sameCalendarDay(e.date, day),
            ),
          ),
        );
  }

  /// Première date d'événement du club (lecture globale : membres uniquement).
  ///
  /// Pour un parent sans fiche, utiliser [getFirstEventDateForTeams].
  Future<DateTime?> getFirstEventDate(String clubId) async {
    final snap =
        await _paths.events(clubId).orderBy(FirestoreFields.date).limit(1).get();
    if (snap.docs.isEmpty) return null;
    return EventDateHelpers.calendarDateFromEventData(snap.docs.first.data());
  }

  /// Première date d'événement parmi [teamIds] (une requête `array-contains`
  /// par équipe — seul chemin lisible par un parent selon les rules).
  Future<DateTime?> getFirstEventDateForTeams({
    required String clubId,
    required List<String> teamIds,
  }) async {
    final uniqueTeamIds = teamIds.where((id) => id.isNotEmpty).toSet();
    if (uniqueTeamIds.isEmpty) return null;

    final dates = await Future.wait(
      uniqueTeamIds.map((teamId) async {
        final snap = await _paths
            .events(clubId)
            .where(FirestoreFields.teamIds, arrayContains: teamId)
            .orderBy(FirestoreFields.date)
            .limit(1)
            .get();
        if (snap.docs.isEmpty) return null;
        return EventDateHelpers.calendarDateFromEventData(
          snap.docs.first.data(),
        );
      }),
    );

    DateTime? earliest;
    for (final date in dates) {
      if (date == null) continue;
      if (earliest == null || date.isBefore(earliest)) earliest = date;
    }
    return earliest;
  }

  /// Charge un événement par id (null si absent).
  Future<ClubEvent?> getEvent({
    required String clubId,
    required String eventId,
  }) async {
    final doc = await _paths.events(clubId).doc(eventId).get();
    if (!doc.exists) return null;
    return ClubEvent.fromFirestore(clubId: clubId, doc: doc);
  }

  /// Prochain événement à venir, ou le plus récent passé (aperçu club).
  Future<ClubEvent?> getHighlightEventForClub(String clubId) async {
    final today = EventDateHelpers.startOfToday();

    final upcoming = await _paths
        .events(clubId)
        .where(
          FirestoreFields.date,
          isGreaterThanOrEqualTo: Timestamp.fromDate(today),
        )
        .orderBy(FirestoreFields.date)
        .limit(3)
        .get();

    for (final doc in upcoming.docs) {
      final event = ClubEvent.fromFirestore(clubId: clubId, doc: doc);
      if (!event.canceled) return event;
    }

    final past = await _paths
        .events(clubId)
        .where(
          FirestoreFields.date,
          isLessThan: Timestamp.fromDate(today),
        )
        .orderBy(FirestoreFields.date, descending: true)
        .limit(5)
        .get();

    for (final doc in past.docs) {
      final event = ClubEvent.fromFirestore(clubId: clubId, doc: doc);
      if (!event.canceled) return event;
    }

    return null;
  }

  /// Aperçu club côté parent : prochain événement à venir des équipes de
  /// l'enfant, sinon le plus récent passé. Requêtes filtrées par équipe.
  Future<ClubEvent?> getHighlightEventForGuardian({
    required String clubId,
    required List<String> childTeamIds,
  }) async {
    final teamIds = childTeamIds.where((id) => id.isNotEmpty).toSet();
    if (teamIds.isEmpty) return null;
    final today = EventDateHelpers.startOfToday();

    ClubEvent? nextUpcoming;
    for (final teamId in teamIds) {
      final upcoming = await _paths
          .events(clubId)
          .where(FirestoreFields.teamIds, arrayContains: teamId)
          .where(
            FirestoreFields.date,
            isGreaterThanOrEqualTo: Timestamp.fromDate(today),
          )
          .orderBy(FirestoreFields.date)
          .limit(3)
          .get();
      for (final doc in upcoming.docs) {
        final event = ClubEvent.fromFirestore(clubId: clubId, doc: doc);
        if (event.canceled) continue;
        if (nextUpcoming == null || event.date.isBefore(nextUpcoming.date)) {
          nextUpcoming = event;
        }
        break;
      }
    }
    if (nextUpcoming != null) return nextUpcoming;

    ClubEvent? latestPast;
    for (final teamId in teamIds) {
      final past = await _paths
          .events(clubId)
          .where(FirestoreFields.teamIds, arrayContains: teamId)
          .where(FirestoreFields.date, isLessThan: Timestamp.fromDate(today))
          .orderBy(FirestoreFields.date, descending: true)
          .limit(5)
          .get();
      for (final doc in past.docs) {
        final event = ClubEvent.fromFirestore(clubId: clubId, doc: doc);
        if (event.canceled) continue;
        if (latestPast == null || event.date.isAfter(latestPast.date)) {
          latestPast = event;
        }
        break;
      }
    }
    return latestPast;
  }
}
