import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';
import 'package:viro_team_v2/services/training/training_library.dart';
import 'package:viro_team_v2/services/training/training_paths.dart';
import 'package:viro_team_v2/utils/calendar_days.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Préparation de séance : une partie par coach (notes libres + exercices).
/// Chaque coach n'écrit que la sienne ; ses collègues et l'admin la lisent.
class TrainingPlanService {
  /// Crée le service (Firestore app par défaut).
  TrainingPlanService({FirebaseFirestore? firestore})
    : _paths = TrainingPaths(firestore ?? appFirestore);

  final TrainingPaths _paths;

  /// Préparations de tous les coachs de la séance.
  Stream<List<TrainingPlan>> watchPlans({
    required String clubId,
    required String eventId,
  }) => _paths
      .plans(clubId, eventId)
      .snapshots()
      .map((snap) => snap.docs.map(TrainingPlan.fromFirestore).toList());

  /// Exercices de la préparation de [coachUid].
  Stream<List<TrainingDrill>> watchDrills({
    required String clubId,
    required String eventId,
    required String coachUid,
  }) => _paths
      .drills(clubId, eventId, coachUid)
      .snapshots()
      .map((snap) => snap.docs.map(TrainingDrill.fromFirestore).toList());

  /// Crée ou met à jour ma partie : [teamIds] = équipes de l'entraînement
  /// (exigé par les règles), [notes] et/ou [drillOrder] si fournis.
  Future<void> savePlan({
    required String clubId,
    required String eventId,
    required String coachUid,
    required String coachName,
    required List<String> teamIds,
    String? notes,
    List<String>? drillOrder,
  }) => _paths.plans(clubId, eventId).doc(coachUid).set({
    FirestoreFields.teamIds: teamIds,
    FirestoreFields.coachName: coachName,
    FirestoreFields.notes: ?notes,
    FirestoreFields.drillOrder: ?drillOrder,
    FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
  }, SetOptions(merge: true));

  /// Nouvel identifiant d'exercice (document pas encore écrit).
  String newDrillId({
    required String clubId,
    required String eventId,
    required String coachUid,
  }) => _paths.drills(clubId, eventId, coachUid).doc().id;

  /// Écrit l'exercice [drill] de ma préparation.
  Future<void> saveDrill({
    required String clubId,
    required String eventId,
    required String coachUid,
    required TrainingDrill drill,
  }) => _paths
      .drills(clubId, eventId, coachUid)
      .doc(drill.id)
      .set(drill.toFirestore());

  /// Supprime l'exercice [drillId] de ma préparation.
  Future<void> deleteDrill({
    required String clubId,
    required String eventId,
    required String coachUid,
    required String drillId,
  }) => _paths.drills(clubId, eventId, coachUid).doc(drillId).delete();

  /// Entraînements terminés des équipes [teamIds] depuis [since], du plus
  /// récent au plus ancien (hors annulés et « tout le club ») : séances de
  /// la bibliothèque. Une requête par lot de 30 équipes (`arrayContainsAny`).
  Future<List<ClubEvent>> loadPastTrainings({
    required String clubId,
    required List<String> teamIds,
    required DateTime since,
    DateTime? now,
  }) async {
    if (teamIds.isEmpty) return const [];
    final reference = now ?? DateTime.now();
    final today = EventDateHelpers.startOfToday();
    // Marge d'un jour : les dates sont stockées à minuit UTC.
    final upperBound = Timestamp.fromDate(addCalendarDays(today, 2));
    final snaps = await Future.wait([
      for (var start = 0; start < teamIds.length; start += _maxArrayContainsAny)
        _paths
            .events(clubId)
            .where(
              FirestoreFields.teamIds,
              arrayContainsAny: teamIds.sublist(
                start,
                min(start + _maxArrayContainsAny, teamIds.length),
              ),
            )
            .where(FirestoreFields.type, isEqualTo: EventTypes.training)
            .where(
              FirestoreFields.date,
              isGreaterThanOrEqualTo: Timestamp.fromDate(since),
            )
            .where(FirestoreFields.date, isLessThan: upperBound)
            .orderBy(FirestoreFields.date, descending: true)
            .get(),
    ]);
    final byId = <String, ClubEvent>{};
    for (final snap in snaps) {
      for (final doc in snap.docs) {
        final event = ClubEvent.fromFirestore(clubId: clubId, doc: doc);
        if (event.canceled || event.allTeams) continue;
        if (!_hasEnded(event, reference)) continue;
        byId[event.id] = event;
      }
    }
    return byId.values.toList()..sort((a, b) => b.date.compareTo(a.date));
  }

  /// Séance terminée : heure de fin (ou de début) passée ; sans heure, une
  /// fois la journée finie (une séance en cours reste « à venir »).
  static bool _hasEnded(ClubEvent event, DateTime now) {
    final end =
        combineEventDateTime(event.date, event.endTime) ??
        combineEventDateTime(event.date, event.startTime);
    if (end != null) return end.isBefore(now);
    final day = DateTime(event.date.year, event.date.month, event.date.day);
    return !addCalendarDays(day, 1).isAfter(now);
  }

  /// Préparations (avec leurs exercices ordonnés) de tous les coachs de la
  /// séance [eventId], lues une fois.
  Future<List<({TrainingPlan plan, List<TrainingDrill> drills})>>
  loadSessionPlans({required String clubId, required String eventId}) async {
    final plansSnap = await _paths.plans(clubId, eventId).get();
    return Future.wait(
      plansSnap.docs.map((doc) async {
        final plan = TrainingPlan.fromFirestore(doc);
        final drillsSnap = await _paths
            .drills(clubId, eventId, plan.coachUid)
            .get();
        return (
          plan: plan,
          drills: plan.ordered(
            drillsSnap.docs.map(TrainingDrill.fromFirestore),
          ),
        );
      }),
    );
  }

  /// Bibliothèque : préparations non vides (exercices ou notes) des
  /// [trainingLibraryMaxEvents] séances les plus récentes de [events], les
  /// miennes comme celles des collègues. Une séance illisible est ignorée.
  Future<List<TrainingLibrarySession>> loadLibrarySessions({
    required String clubId,
    required List<ClubEvent> events,
  }) async {
    final recent = (events.toList()..sort((a, b) => b.date.compareTo(a.date)))
        .take(trainingLibraryMaxEvents);
    final perEvent = await Future.wait(
      recent.map((event) async {
        try {
          final plans = await loadSessionPlans(
            clubId: clubId,
            eventId: event.id,
          );
          return [
            for (final entry in plans)
              if (entry.drills.isNotEmpty || entry.plan.notes.trim().isNotEmpty)
                TrainingLibrarySession(
                  event: event,
                  coachUid: entry.plan.coachUid,
                  coachName: entry.plan.coachName,
                  notes: entry.plan.notes,
                  drills: entry.drills,
                ),
          ];
        } catch (_) {
          return const <TrainingLibrarySession>[];
        }
      }),
    );
    return [for (final sessions in perEvent) ...sessions];
  }

  /// Copie [drills] (nouveaux ids, à la suite de [existingOrder]) dans ma
  /// préparation de [eventId], en un seul lot. [importedNotes] n'est repris
  /// que si [currentNotes] est vide. Retourne les copies créées.
  Future<List<TrainingDrill>> copyDrillsInto({
    required String clubId,
    required String eventId,
    required String coachUid,
    required String coachName,
    required List<String> teamIds,
    required List<String> existingOrder,
    required List<TrainingDrill> drills,
    String currentNotes = '',
    String? importedNotes,
  }) async {
    final copies = [
      for (final drill in drills)
        drill.copyAsNew(
          newDrillId(clubId: clubId, eventId: eventId, coachUid: coachUid),
        ),
    ];
    final notes =
        importedNotes != null &&
            importedNotes.trim().isNotEmpty &&
            currentNotes.trim().isEmpty
        ? importedNotes
        : null;
    if (copies.isEmpty && notes == null) return const [];
    final batch = _paths.db.batch();
    for (final copy in copies) {
      batch.set(
        _paths.drills(clubId, eventId, coachUid).doc(copy.id),
        copy.toFirestore(),
      );
    }
    batch.set(_paths.plans(clubId, eventId).doc(coachUid), {
      FirestoreFields.teamIds: teamIds,
      FirestoreFields.coachName: coachName,
      FirestoreFields.notes: ?notes,
      FirestoreFields.drillOrder: [
        ...existingOrder,
        for (final copy in copies) copy.id,
      ],
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
    await batch.commit();
    return copies;
  }

  /// Valeurs max d'un filtre `arrayContainsAny` (limite Firestore).
  static const int _maxArrayContainsAny = 30;
}
