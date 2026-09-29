import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/services/chat/chat_helpers.dart';
import 'package:viro_team_v2/services/chat/chat_inbox_queries.dart';
import 'package:viro_team_v2/services/chat/chat_paths.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';

/// Regroupe les mutations de conversation et les callables du chat.
class ChatConversationOperations {
  /// Crée le module de gestion des conversations.
  ChatConversationOperations({
    required FirebaseFunctions functions,
    required ChatPaths paths,
    required ChatInboxQueries inboxQueries,
  })  : _functions = functions,
        _paths = paths,
        _inboxQueries = inboxQueries;

  final FirebaseFunctions _functions;
  final ChatPaths _paths;
  final ChatInboxQueries _inboxQueries;

  /// Mute / unmute.
  Future<void> setMuted({
    required String uid,
    required String clubId,
    required String conversationId,
    required bool muted,
  }) async {
    final id = ChatUserState.docId(clubId, conversationId);
    await _paths.chatState(uid).doc(id).set({
      FirestoreFields.muted: muted,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  /// Ajoute / retire la conversation des favoris.
  Future<void> setFavorite({
    required String uid,
    required String clubId,
    required String conversationId,
    required bool favorite,
  }) async {
    final id = ChatUserState.docId(clubId, conversationId);
    await _paths.chatState(uid).doc(id).set({
      FirestoreFields.favorite: favorite,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  /// Marque la conversation comme lue.
  Future<void> markRead({
    required String uid,
    required String clubId,
    required String conversationId,
  }) async {
    final id = ChatUserState.docId(clubId, conversationId);
    await _paths.chatState(uid).doc(id).set({
      FirestoreFields.unreadCount: 0,
      FirestoreFields.lastReadAt: FieldValue.serverTimestamp(),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  /// Renomme la conversation (titleOverride).
  Future<void> renameConversation({
    required String clubId,
    required String conversationId,
    required String titleOverride,
  }) async {
    await _paths.conversations(clubId).doc(conversationId).update({
      FirestoreFields.titleOverride: titleOverride.trim(),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /// Met à jour l’avatar d’une discussion de groupe (`avatarUrl`).
  Future<void> updateConversationAvatar({
    required String clubId,
    required String conversationId,
    required String avatarUrl,
  }) async {
    final trimmed = avatarUrl.trim();
    if (!isConversationAvatarDownloadUrl(
      clubId: clubId,
      conversationId: conversationId,
      url: trimmed,
    )) {
      throw ArgumentError(
        'avatarUrl must be a Firebase Storage download URL '
        'for clubs/$clubId/chat/$conversationId/*/avatar.jpg',
      );
    }
    await _paths.conversations(clubId).doc(conversationId).update({
      FirestoreFields.avatarUrl: trimmed,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /// Callable : démarre une DM avec coaches/admins.
  Future<String> createCoachDm({
    required String clubId,
    required List<String> targetUids,
    String? teamId,
  }) async {
    final callable =
        _functions.httpsCallable(cloudCallableName('createCoachDm'));
    final result = await callable.call(<String, dynamic>{
      'clubId': clubId,
      'targetUids': targetUids,
      if (teamId != null && teamId.isNotEmpty) 'teamId': teamId,
    });
    return _extractConversationId(
      data: result.data,
      errorLabel: 'createCoachDm',
    );
  }

  /// Callable admin : canal ciblé (catégories / équipes / parents).
  Future<String> createCategoryChannel({
    required String clubId,
    required String title,
    required String scopeType,
    required List<String> scopeIds,
    String writePolicy = ChatWritePolicies.adminsOnly,
  }) async {
    final callable =
        _functions.httpsCallable(cloudCallableName('createCategoryChannel'));
    final result = await callable.call(<String, dynamic>{
      'clubId': clubId,
      'title': title,
      'scopeType': scopeType,
      'scopeIds': scopeIds,
      'writePolicy': writePolicy,
    });
    return _extractConversationId(
      data: result.data,
      errorLabel: 'createCategoryChannel',
    );
  }

  /// Backfill chats système d’un club (équipes déjà existantes).
  Future<void> ensureClubChatSynced({required String clubId}) async {
    final callable =
        _functions.httpsCallable(cloudCallableName('ensureClubChatSynced'));
    await callable.call(<String, dynamic>{'clubId': clubId});
  }

  /// Backfill de tous les clubs où l’utilisateur est admin.
  Future<({int clubsSynced, int teamsSynced})>
      backfillMyAdminClubChats() async {
    final callable =
        _functions.httpsCallable(cloudCallableName('backfillMyAdminClubChats'));
    final result = await callable.call(<String, dynamic>{});
    final data = result.data;
    if (data is Map) {
      return (
        clubsSynced: (data['clubsSynced'] as num?)?.toInt() ?? 0,
        teamsSynced: (data['teamsSynced'] as num?)?.toInt() ?? 0,
      );
    }
    return (clubsSynced: 0, teamsSynced: 0);
  }

  /// Ensure puis retrouve une conv système (pour clubs pré-chat).
  Future<String?> ensureAndFindConversationId({
    required String clubId,
    required String systemKey,
  }) async {
    var id = await _inboxQueries.findConversationIdBySystemKey(
      clubId: clubId,
      systemKey: systemKey,
    );
    if (id != null) return id;

    await ensureClubChatSynced(clubId: clubId);
    return _inboxQueries.findConversationIdBySystemKey(
      clubId: clubId,
      systemKey: systemKey,
    );
  }

  String _extractConversationId({
    required Object? data,
    required String errorLabel,
  }) {
    if (data is Map && data['conversationId'] is String) {
      return data['conversationId'] as String;
    }
    throw StateError('$errorLabel: réponse invalide');
  }
}
