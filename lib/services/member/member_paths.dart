import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';

/// Seul point d'accès à la collection `clubs/{clubId}/members` (listes,
/// requêtes, création d'une fiche pré-inscrite à id aléatoire).
///
/// Pour un document précis, passer par [clubMemberRef].
/// Garde-fou : `test/member_key_usage_test.dart`.
CollectionReference<Map<String, dynamic>> clubMembersCollection(
  FirebaseFirestore db,
  String clubId,
) =>
    db
        .collection(ProjectConfig.clubsCollection)
        .doc(clubId)
        .collection(ProjectConfig.membersSubcollection);

/// Seul point d'accès à un document `clubs/{clubId}/members/{memberId}`.
///
/// Clé unique : [memberId] = id de la fiche, égal à l'UID Auth une fois le
/// compte lié (la fiche du compte connecté est donc `members/{authUid}`).
/// Garde-fou : `test/member_key_usage_test.dart`.
DocumentReference<Map<String, dynamic>> clubMemberRef(
  FirebaseFirestore db,
  String clubId,
  String memberId,
) =>
    clubMembersCollection(db, clubId).doc(memberId);
