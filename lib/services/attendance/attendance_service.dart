import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';
import 'package:viro_team_v2/services/event/event_paths.dart';
import 'package:viro_team_v2/utils/calendar_days.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Lecture des événements utiles aux présences (calculs dans
/// `attendance_stats.dart`). Lectures ponctuelles, pas de flux.
class AttendanceService {
  /// Crée le service (Firestore app par défaut).
  AttendanceService({FirebaseFirestore? firestore})
    : _paths = EventPaths(firestore ?? appFirestore);

  final EventPaths _paths;

  /// Borne haute des lectures : demain inclus (les dates sont à minuit UTC),
  /// le tri fin passé / à venir se fait sur l'heure de début.
  static Timestamp _upperBound() =>
      Timestamp.fromDate(addCalendarDays(EventDateHelpers.startOfToday(), 2));

  /// Événements du club depuis [since] (staff : tout le club ; lecture
  /// réservée aux membres du club par les règles). Annulés exclus.
  Future<List<ClubEvent>> loadClubEvents({
    required String clubId,
    required DateTime since,
  }) async {
    final snap = await _paths
        .events(clubId)
        .where(
          FirestoreFields.date,
          isGreaterThanOrEqualTo: Timestamp.fromDate(since),
        )
        .where(FirestoreFields.date, isLessThan: _upperBound())
        .get();
    return [
      for (final doc in snap.docs)
        if (ClubEvent.fromFirestore(clubId: clubId, doc: doc) case final event
            when !event.canceled)
          event,
    ];
  }

  /// Événements des équipes [teamIds] depuis [since] : une requête
  /// `array-contains` par équipe, seule forme permise à un parent (équipes
  /// de ses enfants). Annulés exclus, sans doublon.
  Future<List<ClubEvent>> loadTeamEvents({
    required String clubId,
    required List<String> teamIds,
    required DateTime since,
  }) async {
    if (teamIds.isEmpty) return const [];
    final snaps = await Future.wait([
      for (final teamId in teamIds.toSet())
        _paths
            .events(clubId)
            .where(FirestoreFields.teamIds, arrayContains: teamId)
            .where(
              FirestoreFields.date,
              isGreaterThanOrEqualTo: Timestamp.fromDate(since),
            )
            .where(FirestoreFields.date, isLessThan: _upperBound())
            .get(),
    ]);
    final byId = <String, ClubEvent>{};
    for (final snap in snaps) {
      for (final doc in snap.docs) {
        final event = ClubEvent.fromFirestore(clubId: clubId, doc: doc);
        if (!event.canceled) byId[event.id] = event;
      }
    }
    return byId.values.toList();
  }
}
