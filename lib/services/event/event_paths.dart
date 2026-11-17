import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/services/member/member_paths.dart';

/// Chemins Firestore partagés pour les modules événement.
class EventPaths {
  /// Crée un accès aux collections club liées aux événements.
  const EventPaths(this.db);

  /// Instance Firestore (toujours [appFirestore] côté prod).
  final FirebaseFirestore db;

  /// Collection `clubs/{clubId}/events`.
  CollectionReference<Map<String, dynamic>> events(String clubId) => db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.eventsSubcollection);

  /// Collection `clubs/{clubId}/teams`.
  CollectionReference<Map<String, dynamic>> teams(String clubId) => db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.teamsSubcollection);

  /// Document `clubs/{clubId}/members/{memberId}` (soi : `memberId` = authUid).
  DocumentReference<Map<String, dynamic>> memberRef(
    String clubId,
    String memberId,
  ) =>
      clubMemberRef(db, clubId, memberId);
}
