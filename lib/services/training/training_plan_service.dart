import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/services/training/training_paths.dart';
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
}
