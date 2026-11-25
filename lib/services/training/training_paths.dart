import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';

/// Chemins Firestore des outils d'entraînement, sous
/// `clubs/{clubId}/events/{eventId}` (une partie par coach).
class TrainingPaths {
  /// Crée les chemins sur [db] (toujours `appFirestore` hors tests).
  const TrainingPaths(this.db);

  final FirebaseFirestore db;

  /// Collection `clubs/{clubId}/events`.
  CollectionReference<Map<String, dynamic>> events(String clubId) => db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.eventsSubcollection);

  /// Document `clubs/{clubId}/events/{eventId}`.
  DocumentReference<Map<String, dynamic>> event(
    String clubId,
    String eventId,
  ) => events(clubId).doc(eventId);

  /// Collection des préparations (une par coach).
  CollectionReference<Map<String, dynamic>> plans(
    String clubId,
    String eventId,
  ) => event(
    clubId,
    eventId,
  ).collection(ProjectConfig.trainingPlansSubcollection);

  /// Exercices de la préparation de [coachUid].
  CollectionReference<Map<String, dynamic>> drills(
    String clubId,
    String eventId,
    String coachUid,
  ) => plans(
    clubId,
    eventId,
  ).doc(coachUid).collection(ProjectConfig.trainingDrillsSubcollection);

  /// Brouillon de retour de [coachUid].
  DocumentReference<Map<String, dynamic>> draft(
    String clubId,
    String eventId,
    String coachUid,
  ) => event(
    clubId,
    eventId,
  ).collection(ProjectConfig.trainingFeedbackDraftsSubcollection).doc(coachUid);

  /// Collection des retours envoyés (un par coach).
  CollectionReference<Map<String, dynamic>> feedbacks(
    String clubId,
    String eventId,
  ) => event(
    clubId,
    eventId,
  ).collection(ProjectConfig.trainingFeedbackSubcollection);

  /// Messages perso envoyés par [coachUid].
  CollectionReference<Map<String, dynamic>> playerMessages(
    String clubId,
    String eventId,
    String coachUid,
  ) => feedbacks(
    clubId,
    eventId,
  ).doc(coachUid).collection(ProjectConfig.trainingPlayerMessagesSubcollection);

  /// États perso de [uid] sur les entraînements (flemme, retours lus).
  CollectionReference<Map<String, dynamic>> userStates(String uid) => db
      .collection(ProjectConfig.usersCollection)
      .doc(uid)
      .collection(ProjectConfig.trainingFeedbackStateSubcollection);
}
