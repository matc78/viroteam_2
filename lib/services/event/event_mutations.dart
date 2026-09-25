import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/models/club_activity_event.dart';
import 'package:viro_team_v2/services/club_activity_service.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';
import 'package:viro_team_v2/services/event/event_paths.dart';

/// Création et annulation d'événements (y compris séries récurrentes).
class EventMutations {
  /// Crée le module de mutations événements.
  EventMutations({
    required EventPaths paths,
    required ClubActivityService activity,
  })  : _paths = paths,
        _activity = activity;

  final EventPaths _paths;
  final ClubActivityService _activity;

  /// Crée un ou plusieurs événements (récurrence hebdomadaire pour entraînements).
  Future<int> createEvents({
    required String clubId,
    required String creatorId,
    required String type,
    required String title,
    required DateTime startDate,
    required List<String> teamIds,
    required List<String> teamMemberIds,
    required bool allTeams,
    String? location,
    String? startTime,
    String? endTime,
    String? meetingTime,
    String? meetingLocation,
    String? matchVenue,
    DateTime? recurrenceEndDate,
  }) async {
    final dates = _recurrenceDates(
      startDate: startDate,
      recurrenceEndDate: recurrenceEndDate,
    );
    final seriesId =
        dates.length > 1 ? _paths.events(clubId).doc().id : null;

    final batch = _paths.db.batch();
    for (final date in dates) {
      final ref = _paths.events(clubId).doc();
      batch.set(ref, {
        FirestoreFields.type: type,
        FirestoreFields.title: title,
        FirestoreFields.location: location ?? '',
        FirestoreFields.teamIds: teamIds,
        FirestoreFields.allTeams: allTeams,
        FirestoreFields.date: Timestamp.fromDate(
          DateTime.utc(date.year, date.month, date.day),
        ),
        FirestoreFields.dateId: EventDateHelpers.dateIdFor(date),
        FirestoreFields.startTime: ?startTime,
        FirestoreFields.endTime: ?endTime,
        FirestoreFields.meetingTime: ?meetingTime,
        if (meetingLocation != null && meetingLocation.isNotEmpty)
          FirestoreFields.meetingLocation: meetingLocation,
        FirestoreFields.matchVenue: ?matchVenue,
        FirestoreFields.seriesId: ?seriesId,
        FirestoreFields.teamMemberIds: teamMemberIds,
        FirestoreFields.rsvp: <String, String>{},
        FirestoreFields.attendance: <String, dynamic>{},
        FirestoreFields.creatorId: creatorId,
        FirestoreFields.canceled: false,
        FirestoreFields.createdAt: FieldValue.serverTimestamp(),
      });
    }
    _activity.appendToBatch(
      batch: batch,
      clubId: clubId,
      type: ClubActivityTypes.eventsCreated,
      actorUid: creatorId,
      count: dates.length,
      summary: title,
    );
    await batch.commit();
    return dates.length;
  }

  List<DateTime> _recurrenceDates({
    required DateTime startDate,
    DateTime? recurrenceEndDate,
  }) {
    final start = EventDateHelpers.startOfDay(startDate);
    if (recurrenceEndDate == null) return [start];

    final end = EventDateHelpers.startOfDay(recurrenceEndDate);
    if (end.isBefore(start)) return [start];

    final dates = <DateTime>[];
    var d = start;
    while (!d.isAfter(end) && dates.length < 52) {
      dates.add(d);
      d = d.add(const Duration(days: 7));
    }
    return dates.isEmpty ? [start] : dates;
  }

  /// Annule un événement (marque `canceled`).
  Future<void> cancelEvent({
    required String clubId,
    required String eventId,
    String? title,
  }) async {
    await _paths.events(clubId).doc(eventId).update({
      FirestoreFields.canceled: true,
    });
    await _activity.log(
      clubId: clubId,
      type: ClubActivityTypes.eventCancelled,
      count: 1,
      summary: title?.trim() ?? '',
      eventId: eventId,
    );
  }

  /// Annule tous les événements d'une série récurrente.
  Future<int> cancelEventSeries({
    required String clubId,
    required String seriesId,
    String? title,
  }) async {
    final snap = await _paths
        .events(clubId)
        .where(FirestoreFields.seriesId, isEqualTo: seriesId)
        .get();
    if (snap.docs.isEmpty) return 0;

    final batch = _paths.db.batch();
    for (final doc in snap.docs) {
      batch.update(doc.reference, {FirestoreFields.canceled: true});
    }
    _activity.appendToBatch(
      batch: batch,
      clubId: clubId,
      type: ClubActivityTypes.eventCancelled,
      count: snap.docs.length,
      summary: title?.trim() ?? '',
    );
    await batch.commit();
    return snap.docs.length;
  }
}
