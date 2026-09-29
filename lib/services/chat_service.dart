import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/services/chat/chat_conversation_operations.dart';
import 'package:viro_team_v2/services/chat/chat_inbox_queries.dart';
import 'package:viro_team_v2/services/chat/chat_message_operations.dart';
import 'package:viro_team_v2/services/chat/chat_paths.dart';
import 'package:viro_team_v2/services/chat/chat_poll_reaction_operations.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Accès Firestore / Storage / callables pour le chat in-app.
///
/// L’implémentation est découpée dans `lib/services/chat/` ; l’API publique
/// reste stable pour les call sites (`chatServiceProvider`, `ChatService()`).
class ChatService {
  ChatService({
    FirebaseFirestore? firestore,
    FirebaseStorage? storage,
    FirebaseFunctions? functions,
  }) {
    final db = firestore ?? appFirestore;
    final resolvedStorage = storage ?? FirebaseStorage.instance;
    final resolvedFunctions =
        functions ?? FirebaseFunctions.instanceFor(region: 'europe-west1');
    final paths = ChatPaths(db);

    _queries = ChatInboxQueries(paths: paths);
    _messages = ChatMessageOperations(
      firestore: db,
      storage: resolvedStorage,
      paths: paths,
    );
    _polls = ChatPollReactionOperations(firestore: db, paths: paths);
    _conversations = ChatConversationOperations(
      functions: resolvedFunctions,
      paths: paths,
      inboxQueries: _queries,
    );
  }

  late final ChatInboxQueries _queries;
  late final ChatMessageOperations _messages;
  late final ChatPollReactionOperations _polls;
  late final ChatConversationOperations _conversations;

  /// Conversations d’un club où [uid] est participant.
  Stream<List<ChatConversation>> watchClubConversations({
    required String clubId,
    required String uid,
  }) =>
      _queries.watchClubConversations(clubId: clubId, uid: uid);

  /// Fusion multi-clubs des conversations de l’utilisateur.
  Stream<List<ChatConversation>> watchInbox({
    required String uid,
    required List<String> clubIds,
  }) =>
      _queries.watchInbox(uid: uid, clubIds: clubIds);

  /// Une conversation.
  Stream<ChatConversation?> watchConversation({
    required String clubId,
    required String conversationId,
  }) =>
      _queries.watchConversation(
        clubId: clubId,
        conversationId: conversationId,
      );

  /// Messages récents (ordre chrono croissant pour l’UI).
  Stream<List<ChatMessage>> watchMessages({
    required String clubId,
    required String conversationId,
    int limit = 50,
  }) =>
      _queries.watchMessages(
        clubId: clubId,
        conversationId: conversationId,
        limit: limit,
      );

  /// Un message précis (hors fenêtre live du thread).
  Stream<ChatMessage?> watchMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
  }) =>
      _queries.watchMessage(
        clubId: clubId,
        conversationId: conversationId,
        messageId: messageId,
      );

  /// États chat de l’utilisateur (mute / unread).
  Stream<Map<String, ChatUserState>> watchChatStates(String uid) =>
      _queries.watchChatStates(uid);

  /// Alloue un id Firestore pour un envoi optimiste (même id côté UI / serveur).
  String allocateMessageId({
    required String clubId,
    required String conversationId,
  }) =>
      _messages.allocateMessageId(
        clubId: clubId,
        conversationId: conversationId,
      );

  /// Envoie un message texte (espaces / sauts de ligne en fin retirés) et met à jour le preview conversation.
  ///
  /// Retourne l’id du document créé. Passe [clientMessageId] pour unifier l’optimistic UI.
  Future<String> sendTextMessage({
    required String clubId,
    required String conversationId,
    required String senderUid,
    required String text,
    String? senderFirstName,
    String? senderRole,
    String? replyToMessageId,
    String? replyToText,
    String? replyToSenderUid,
    String? clientMessageId,
  }) =>
      _messages.sendTextMessage(
        clubId: clubId,
        conversationId: conversationId,
        senderUid: senderUid,
        text: text,
        senderFirstName: senderFirstName,
        senderRole: senderRole,
        replyToMessageId: replyToMessageId,
        replyToText: replyToText,
        replyToSenderUid: replyToSenderUid,
        clientMessageId: clientMessageId,
      );

  /// Upload photo puis crée le message image (full + thumb).
  ///
  /// Retourne l’id du document. Passe [clientMessageId] pour l’optimistic UI.
  Future<String> sendImageMessage({
    required String clubId,
    required String conversationId,
    required String senderUid,
    required Uint8List bytes,
    String contentType = 'image/jpeg',
    String? senderFirstName,
    String? senderRole,
    String? replyToMessageId,
    String? replyToText,
    String? replyToSenderUid,
    String? clientMessageId,
  }) =>
      _messages.sendImageMessage(
        clubId: clubId,
        conversationId: conversationId,
        senderUid: senderUid,
        bytes: bytes,
        contentType: contentType,
        senderFirstName: senderFirstName,
        senderRole: senderRole,
        replyToMessageId: replyToMessageId,
        replyToText: replyToText,
        replyToSenderUid: replyToSenderUid,
        clientMessageId: clientMessageId,
      );

  /// Charge une page de messages plus anciens que [beforeMessageId].
  Future<List<ChatMessage>> fetchOlderMessages({
    required String clubId,
    required String conversationId,
    required String beforeMessageId,
    int limit = 50,
  }) =>
      _queries.fetchOlderMessages(
        clubId: clubId,
        conversationId: conversationId,
        beforeMessageId: beforeMessageId,
        limit: limit,
      );

  /// Soft-delete d’un message.
  Future<void> softDeleteMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String deletedByUid,
  }) =>
      _messages.softDeleteMessage(
        clubId: clubId,
        conversationId: conversationId,
        messageId: messageId,
        deletedByUid: deletedByUid,
      );

  /// Modifie le texte d’un message (auteur uniquement).
  ///
  /// Si le message édité est le dernier, met aussi à jour `lastMessagePreview`.
  Future<void> editTextMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String text,
  }) =>
      _messages.editTextMessage(
        clubId: clubId,
        conversationId: conversationId,
        messageId: messageId,
        text: text,
      );

  /// Crée un sondage (groupes / canaux — pas les DM 1:1).
  Future<void> sendPollMessage({
    required String clubId,
    required String conversationId,
    required String senderUid,
    required String question,
    required List<String> optionTexts,
    bool allowMultiple = false,
    String? senderFirstName,
    String? senderRole,
  }) =>
      _polls.sendPollMessage(
        clubId: clubId,
        conversationId: conversationId,
        senderUid: senderUid,
        question: question,
        optionTexts: optionTexts,
        allowMultiple: allowMultiple,
        senderFirstName: senderFirstName,
        senderRole: senderRole,
      );

  /// Vote (ou retire le vote) sur une option de sondage.
  Future<void> votePollOption({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String optionId,
    required String uid,
  }) =>
      _polls.votePollOption(
        clubId: clubId,
        conversationId: conversationId,
        messageId: messageId,
        optionId: optionId,
        uid: uid,
      );

  /// Toggle réaction emoji (ajoute ou retire l’uid).
  Future<void> toggleReaction({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String emoji,
    required String uid,
  }) =>
      _polls.toggleReaction(
        clubId: clubId,
        conversationId: conversationId,
        messageId: messageId,
        emoji: emoji,
        uid: uid,
      );

  /// Mute / unmute.
  Future<void> setMuted({
    required String uid,
    required String clubId,
    required String conversationId,
    required bool muted,
  }) =>
      _conversations.setMuted(
        uid: uid,
        clubId: clubId,
        conversationId: conversationId,
        muted: muted,
      );

  /// Ajoute / retire la conversation des favoris.
  Future<void> setFavorite({
    required String uid,
    required String clubId,
    required String conversationId,
    required bool favorite,
  }) =>
      _conversations.setFavorite(
        uid: uid,
        clubId: clubId,
        conversationId: conversationId,
        favorite: favorite,
      );

  /// Trie l’inbox : favoris en tête, puis date du dernier message.
  static List<ChatConversation> sortInboxConversations(
    List<ChatConversation> conversations,
    Map<String, ChatUserState> chatStates,
  ) =>
      ChatInboxQueries.sortInboxConversations(conversations, chatStates);

  /// Marque la conversation comme lue.
  Future<void> markRead({
    required String uid,
    required String clubId,
    required String conversationId,
  }) =>
      _conversations.markRead(
        uid: uid,
        clubId: clubId,
        conversationId: conversationId,
      );

  /// Renomme la conversation (titleOverride).
  Future<void> renameConversation({
    required String clubId,
    required String conversationId,
    required String titleOverride,
  }) =>
      _conversations.renameConversation(
        clubId: clubId,
        conversationId: conversationId,
        titleOverride: titleOverride,
      );

  /// Met à jour l’avatar d’une discussion de groupe (`avatarUrl`).
  ///
  /// [avatarUrl] doit être une URL download Storage du path
  /// `clubs/{clubId}/chat/{conversationId}/{uid}/avatar.jpg`.
  Future<void> updateConversationAvatar({
    required String clubId,
    required String conversationId,
    required String avatarUrl,
  }) =>
      _conversations.updateConversationAvatar(
        clubId: clubId,
        conversationId: conversationId,
        avatarUrl: avatarUrl,
      );

  /// Callable : démarre une DM avec coaches/admins.
  Future<String> createCoachDm({
    required String clubId,
    required List<String> targetUids,
    String? teamId,
  }) =>
      _conversations.createCoachDm(
        clubId: clubId,
        targetUids: targetUids,
        teamId: teamId,
      );

  /// Callable admin : canal ciblé (catégories / équipes / parents).
  Future<String> createCategoryChannel({
    required String clubId,
    required String title,
    required String scopeType,
    required List<String> scopeIds,
    String writePolicy = ChatWritePolicies.adminsOnly,
  }) =>
      _conversations.createCategoryChannel(
        clubId: clubId,
        title: title,
        scopeType: scopeType,
        scopeIds: scopeIds,
        writePolicy: writePolicy,
      );

  /// Retrouve une conv système par clé (ex. `team:{id}`).
  Future<String?> findConversationIdBySystemKey({
    required String clubId,
    required String systemKey,
  }) =>
      _queries.findConversationIdBySystemKey(
        clubId: clubId,
        systemKey: systemKey,
      );

  /// Backfill chats système d’un club (équipes déjà existantes).
  Future<void> ensureClubChatSynced({required String clubId}) =>
      _conversations.ensureClubChatSynced(clubId: clubId);

  /// Backfill de tous les clubs où l’utilisateur est admin.
  Future<({int clubsSynced, int teamsSynced})> backfillMyAdminClubChats() =>
      _conversations.backfillMyAdminClubChats();

  /// Ensure puis retrouve une conv système (pour clubs pré-chat).
  Future<String?> ensureAndFindConversationId({
    required String clubId,
    required String systemKey,
  }) =>
      _conversations.ensureAndFindConversationId(
        clubId: clubId,
        systemKey: systemKey,
      );
}
