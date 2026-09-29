import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/services/chat/chat_paths.dart';
import 'package:viro_team_v2/utils/stream_combine.dart';

/// Regroupe les lectures live et paginées du chat.
class ChatInboxQueries {
  /// Crée le module de lecture du chat.
  ChatInboxQueries({required ChatPaths paths}) : _paths = paths;

  final ChatPaths _paths;

  /// Conversations d’un club où [uid] est participant.
  Stream<List<ChatConversation>> watchClubConversations({
    required String clubId,
    required String uid,
  }) {
    return _paths
        .conversations(clubId)
        .where(FirestoreFields.participantUids, arrayContains: uid)
        .snapshots()
        .map((snap) {
      final conversations = snap.docs
          .map(
            (doc) => ChatConversation.fromFirestore(clubId: clubId, doc: doc),
          )
          .toList();
      conversations.sort(_compareByRecentActivity);
      return conversations;
    });
  }

  /// Fusion multi-clubs des conversations de l’utilisateur.
  Stream<List<ChatConversation>> watchInbox({
    required String uid,
    required List<String> clubIds,
  }) {
    if (clubIds.isEmpty) {
      return Stream.value(const []);
    }

    final streams = clubIds
        .map((clubId) => watchClubConversations(clubId: clubId, uid: uid))
        .toList();
    return combineLatestListStreams(streams).map((merged) {
      final sorted = List<ChatConversation>.from(merged);
      sorted.sort(_compareByRecentActivity);
      return sorted;
    });
  }

  /// Une conversation.
  Stream<ChatConversation?> watchConversation({
    required String clubId,
    required String conversationId,
  }) {
    return _paths.conversations(clubId).doc(conversationId).snapshots().map((
      doc,
    ) {
      if (!doc.exists) return null;
      return ChatConversation.fromFirestore(clubId: clubId, doc: doc);
    });
  }

  /// Messages récents (ordre chrono croissant pour l’UI).
  Stream<List<ChatMessage>> watchMessages({
    required String clubId,
    required String conversationId,
    int limit = 50,
  }) {
    return _paths
        .messages(clubId, conversationId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .limit(limit)
        .snapshots()
        .map((snap) {
      final messages = snap.docs
          .map(
            (doc) => ChatMessage.fromFirestore(
              clubId: clubId,
              conversationId: conversationId,
              doc: doc,
            ),
          )
          .toList();
      return messages.reversed.toList();
    });
  }

  /// Un message précis (hors fenêtre live du thread).
  Stream<ChatMessage?> watchMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
  }) {
    return _paths
        .messages(clubId, conversationId)
        .doc(messageId)
        .snapshots()
        .map((doc) {
      if (!doc.exists) return null;
      return ChatMessage.fromFirestore(
        clubId: clubId,
        conversationId: conversationId,
        doc: doc,
      );
    });
  }

  /// États chat de l’utilisateur (mute / unread).
  Stream<Map<String, ChatUserState>> watchChatStates(String uid) {
    return _paths.chatState(uid).snapshots().map((snap) {
      final states = <String, ChatUserState>{};
      for (final doc in snap.docs) {
        states[doc.id] = ChatUserState.fromFirestore(doc);
      }
      return states;
    });
  }

  /// Charge une page de messages plus anciens que [beforeMessageId].
  Future<List<ChatMessage>> fetchOlderMessages({
    required String clubId,
    required String conversationId,
    required String beforeMessageId,
    int limit = 50,
  }) async {
    final beforeSnap = await _paths
        .messages(clubId, conversationId)
        .doc(beforeMessageId)
        .get();
    if (!beforeSnap.exists) return const [];

    final snap = await _paths
        .messages(clubId, conversationId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .startAfterDocument(beforeSnap)
        .limit(limit)
        .get();
    final messages = snap.docs
        .map(
          (doc) => ChatMessage.fromFirestore(
            clubId: clubId,
            conversationId: conversationId,
            doc: doc,
          ),
        )
        .toList();
    return messages.reversed.toList();
  }

  /// Retrouve une conv système par clé (ex. `team:{id}`).
  Future<String?> findConversationIdBySystemKey({
    required String clubId,
    required String systemKey,
  }) async {
    final snap = await _paths
        .conversations(clubId)
        .where(FirestoreFields.systemKey, isEqualTo: systemKey)
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return null;
    return snap.docs.first.id;
  }

  /// Trie l’inbox : favoris en tête, puis date du dernier message.
  static List<ChatConversation> sortInboxConversations(
    List<ChatConversation> conversations,
    Map<String, ChatUserState> chatStates,
  ) {
    final sorted = [...conversations];
    sorted.sort((a, b) {
      final aFavorite =
          chatStates[ChatUserState.docId(a.clubId, a.id)]?.favorite == true
              ? 1
              : 0;
      final bFavorite =
          chatStates[ChatUserState.docId(b.clubId, b.id)]?.favorite == true
              ? 1
              : 0;
      if (aFavorite != bFavorite) return bFavorite - aFavorite;
      return _compareByRecentActivity(a, b);
    });
    return sorted;
  }

  static int _compareByRecentActivity(
    ChatConversation a,
    ChatConversation b,
  ) {
    final aAt = a.lastMessageAt ?? a.createdAt ?? DateTime(1970);
    final bAt = b.lastMessageAt ?? b.createdAt ?? DateTime(1970);
    return bAt.compareTo(aAt);
  }
}
