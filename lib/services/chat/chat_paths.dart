import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';

/// Centralise les chemins Firestore utilisés par le chat.
class ChatPaths {
  /// Crée un résolveur de chemins à partir de [db].
  ChatPaths(this.db);

  final FirebaseFirestore db;

  /// `clubs/{clubId}/conversations`
  CollectionReference<Map<String, dynamic>> conversations(String clubId) => db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.conversationsSubcollection);

  /// `clubs/{clubId}/conversations/{conversationId}/messages`
  CollectionReference<Map<String, dynamic>> messages(
    String clubId,
    String conversationId,
  ) =>
      conversations(clubId)
          .doc(conversationId)
          .collection(ProjectConfig.chatMessagesSubcollection);

  /// `users/{uid}/chatState`
  CollectionReference<Map<String, dynamic>> chatState(String uid) => db
      .collection(ProjectConfig.usersCollection)
      .doc(uid)
      .collection(ProjectConfig.chatStateSubcollection);
}
