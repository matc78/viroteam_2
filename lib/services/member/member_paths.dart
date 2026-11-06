import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';

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
    db
        .collection(ProjectConfig.clubsCollection)
        .doc(clubId)
        .collection(ProjectConfig.membersSubcollection)
        .doc(memberId);
