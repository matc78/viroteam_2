import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/utils/chat_image_prepare.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';
import 'package:viro_team_v2/utils/stream_combine.dart';

/// Accès Firestore / Storage / callables pour le chat in-app.
class ChatService {
  ChatService({
    FirebaseFirestore? firestore,
    FirebaseStorage? storage,
    FirebaseFunctions? functions,
  })  : _db = firestore ?? appFirestore,
        _storage = storage ?? FirebaseStorage.instance,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFirestore _db;
  final FirebaseStorage _storage;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> _conversations(String clubId) =>
      _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.conversationsSubcollection);

  CollectionReference<Map<String, dynamic>> _messages(
    String clubId,
    String conversationId,
  ) =>
      _conversations(clubId)
          .doc(conversationId)
          .collection(ProjectConfig.chatMessagesSubcollection);

  CollectionReference<Map<String, dynamic>> _chatState(String uid) => _db
      .collection(ProjectConfig.usersCollection)
      .doc(uid)
      .collection(ProjectConfig.chatStateSubcollection);

  /// Conversations d’un club où [uid] est participant.
  Stream<List<ChatConversation>> watchClubConversations({
    required String clubId,
    required String uid,
  }) {
    return _conversations(clubId)
        .where(FirestoreFields.participantUids, arrayContains: uid)
        .snapshots()
        .map((snap) {
      final list = snap.docs
          .map(
            (doc) => ChatConversation.fromFirestore(clubId: clubId, doc: doc),
          )
          .toList();
      list.sort((a, b) {
        final aAt = a.lastMessageAt ?? a.createdAt ?? DateTime(1970);
        final bAt = b.lastMessageAt ?? b.createdAt ?? DateTime(1970);
        return bAt.compareTo(aAt);
      });
      return list;
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
        .map(
          (clubId) => watchClubConversations(clubId: clubId, uid: uid),
        )
        .toList();
    return combineLatestListStreams(streams).map((merged) {
      final sorted = List<ChatConversation>.from(merged);
      sorted.sort((a, b) {
        final aAt = a.lastMessageAt ?? a.createdAt ?? DateTime(1970);
        final bAt = b.lastMessageAt ?? b.createdAt ?? DateTime(1970);
        return bAt.compareTo(aAt);
      });
      return sorted;
    });
  }

  /// Une conversation.
  Stream<ChatConversation?> watchConversation({
    required String clubId,
    required String conversationId,
  }) {
    return _conversations(clubId).doc(conversationId).snapshots().map((doc) {
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
    return _messages(clubId, conversationId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .limit(limit)
        .snapshots()
        .map((snap) {
      final list = snap.docs
          .map(
            (doc) => ChatMessage.fromFirestore(
              clubId: clubId,
              conversationId: conversationId,
              doc: doc,
            ),
          )
          .toList();
      return list.reversed.toList();
    });
  }

  /// Un message précis (hors fenêtre live du thread).
  Stream<ChatMessage?> watchMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
  }) {
    return _messages(clubId, conversationId).doc(messageId).snapshots().map(
      (doc) {
        if (!doc.exists) return null;
        return ChatMessage.fromFirestore(
          clubId: clubId,
          conversationId: conversationId,
          doc: doc,
        );
      },
    );
  }

  /// États chat de l’utilisateur (mute / unread).
  Stream<Map<String, ChatUserState>> watchChatStates(String uid) {
    return _chatState(uid).snapshots().map((snap) {
      final map = <String, ChatUserState>{};
      for (final doc in snap.docs) {
        map[doc.id] = ChatUserState.fromFirestore(doc);
      }
      return map;
    });
  }

  /// Envoie un message texte (espaces / sauts de ligne en fin retirés) et met à jour le preview conversation.
  Future<void> sendTextMessage({
    required String clubId,
    required String conversationId,
    required String senderUid,
    required String text,
    String? senderFirstName,
    String? senderRole,
    String? replyToMessageId,
    String? replyToText,
    String? replyToSenderUid,
  }) async {
    final trimmed = text.trimRight();
    if (trimmed.trim().isEmpty) return;
    final ref = _messages(clubId, conversationId).doc();
    final batch = _db.batch();
    final replyId = replyToMessageId?.trim();
    final replyPreview = replyToText?.trim();
    final replySender = replyToSenderUid?.trim();
    batch.set(ref, {
      FirestoreFields.type: ChatMessageTypes.text,
      FirestoreFields.text: trimmed,
      FirestoreFields.senderUid: senderUid,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
      FirestoreFields.reactions: <String, dynamic>{},
      if (replyId != null &&
          replyId.isNotEmpty &&
          replyPreview != null &&
          replyPreview.isNotEmpty) ...{
        FirestoreFields.replyToMessageId: replyId,
        FirestoreFields.replyToText: replyPreview.length > 140
            ? '${replyPreview.substring(0, 137)}…'
            : replyPreview,
        if (replySender != null && replySender.isNotEmpty)
          FirestoreFields.replyToSenderUid: replySender,
      },
    });
    batch.update(_conversations(clubId).doc(conversationId), {
      FirestoreFields.lastMessageAt: FieldValue.serverTimestamp(),
      FirestoreFields.lastMessagePreview: trimmed.length > 120
          ? '${trimmed.substring(0, 117)}…'
          : trimmed,
      FirestoreFields.lastSenderUid: senderUid,
      if (senderFirstName != null && senderFirstName.trim().isNotEmpty)
        FirestoreFields.lastSenderFirstName: senderFirstName.trim(),
      if (senderRole != null && senderRole.trim().isNotEmpty)
        FirestoreFields.lastSenderRole: senderRole.trim(),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }

  /// Upload photo puis crée le message image (full + thumb).
  Future<void> sendImageMessage({
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
  }) async {
    final prepared = await prepareChatImageUpload(bytes);
    final ref = _messages(clubId, conversationId).doc();
    // Segment uid : Storage rules ne peuvent pas lire v2-dev/v2-prod.
    final path =
        'clubs/$clubId/chat/$conversationId/$senderUid/${ref.id}.jpg';
    final thumbPath =
        'clubs/$clubId/chat/$conversationId/$senderUid/${ref.id}_thumb.png';
    final storageRef = _storage.ref().child(path);
    final thumbRef = _storage.ref().child(thumbPath);
    await storageRef.putData(
      prepared.fullBytes,
      SettableMetadata(contentType: contentType),
    );
    await thumbRef.putData(
      prepared.thumbBytes,
      SettableMetadata(contentType: prepared.thumbContentType),
    );
    final url = await storageRef.getDownloadURL();
    final thumbUrl = await thumbRef.getDownloadURL();
    final batch = _db.batch();
    final replyId = replyToMessageId?.trim();
    final replyPreview = replyToText?.trim();
    final replySender = replyToSenderUid?.trim();
    batch.set(ref, {
      FirestoreFields.type: ChatMessageTypes.image,
      FirestoreFields.storagePath: path,
      FirestoreFields.downloadUrl: url,
      FirestoreFields.thumbUrl: thumbUrl,
      FirestoreFields.width: prepared.width,
      FirestoreFields.height: prepared.height,
      FirestoreFields.senderUid: senderUid,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
      FirestoreFields.reactions: <String, dynamic>{},
      if (replyId != null &&
          replyId.isNotEmpty &&
          replyPreview != null &&
          replyPreview.isNotEmpty) ...{
        FirestoreFields.replyToMessageId: replyId,
        FirestoreFields.replyToText: replyPreview.length > 140
            ? '${replyPreview.substring(0, 137)}…'
            : replyPreview,
        if (replySender != null && replySender.isNotEmpty)
          FirestoreFields.replyToSenderUid: replySender,
      },
    });
    batch.update(_conversations(clubId).doc(conversationId), {
      FirestoreFields.lastMessageAt: FieldValue.serverTimestamp(),
      FirestoreFields.lastMessagePreview: '📷 Photo',
      FirestoreFields.lastSenderUid: senderUid,
      if (senderFirstName != null && senderFirstName.trim().isNotEmpty)
        FirestoreFields.lastSenderFirstName: senderFirstName.trim(),
      if (senderRole != null && senderRole.trim().isNotEmpty)
        FirestoreFields.lastSenderRole: senderRole.trim(),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }

  /// Charge une page de messages plus anciens que [beforeMessageId].
  Future<List<ChatMessage>> fetchOlderMessages({
    required String clubId,
    required String conversationId,
    required String beforeMessageId,
    int limit = 50,
  }) async {
    final beforeSnap =
        await _messages(clubId, conversationId).doc(beforeMessageId).get();
    if (!beforeSnap.exists) return const [];
    final snap = await _messages(clubId, conversationId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .startAfterDocument(beforeSnap)
        .limit(limit)
        .get();
    final list = snap.docs
        .map(
          (doc) => ChatMessage.fromFirestore(
            clubId: clubId,
            conversationId: conversationId,
            doc: doc,
          ),
        )
        .toList();
    return list.reversed.toList();
  }

  /// Soft-delete d’un message.
  Future<void> softDeleteMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String deletedByUid,
  }) async {
    await _messages(clubId, conversationId).doc(messageId).update({
      FirestoreFields.deletedAt: FieldValue.serverTimestamp(),
      FirestoreFields.deletedByUid: deletedByUid,
    });
  }

  /// Modifie le texte d’un message (auteur uniquement).
  ///
  /// Si le message édité est le dernier, met aussi à jour `lastMessagePreview`.
  Future<void> editTextMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String text,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    final preview = trimmed.length > 120
        ? '${trimmed.substring(0, 117)}…'
        : trimmed;
    final messageRef = _messages(clubId, conversationId).doc(messageId);
    final latestSnap = await _messages(clubId, conversationId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .limit(1)
        .get();
    final isLatest =
        latestSnap.docs.isNotEmpty && latestSnap.docs.first.id == messageId;
    final batch = _db.batch();
    batch.update(messageRef, {
      FirestoreFields.text: trimmed,
      FirestoreFields.editedAt: FieldValue.serverTimestamp(),
    });
    if (isLatest) {
      batch.update(_conversations(clubId).doc(conversationId), {
        FirestoreFields.lastMessagePreview: preview,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

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
  }) async {
    final trimmedQuestion = question.trim();
    final options = optionTexts
        .map((text) => text.trim())
        .where((text) => text.isNotEmpty)
        .toList();
    if (trimmedQuestion.isEmpty || options.length < 2) {
      throw ArgumentError('Sondage : question + au moins 2 options.');
    }
    if (options.length > 12) {
      throw ArgumentError('Sondage : 12 options max.');
    }

    final convSnap = await _conversations(clubId).doc(conversationId).get();
    final convData = convSnap.data();
    final participants = (convData?[FirestoreFields.participantUids]
                as List<dynamic>?)
            ?.whereType<String>()
            .toList() ??
        const <String>[];
    // Aligné règles Firestore : `participantUids.size() > 2`.
    if (participants.length <= 2) {
      throw StateError('Les sondages sont réservés aux groupes (> 2).');
    }

    final pollOptions = <Map<String, dynamic>>[];
    final pollVotes = <String, List<String>>{};
    for (var i = 0; i < options.length; i++) {
      final id = 'o$i';
      pollOptions.add({'id': id, 'text': options[i]});
      pollVotes[id] = <String>[];
    }

    final ref = _messages(clubId, conversationId).doc();
    final preview = '📊 $trimmedQuestion';
    final batch = _db.batch();
    batch.set(ref, {
      FirestoreFields.type: ChatMessageTypes.poll,
      FirestoreFields.text: trimmedQuestion,
      FirestoreFields.pollQuestion: trimmedQuestion,
      FirestoreFields.pollOptions: pollOptions,
      FirestoreFields.pollVotes: pollVotes,
      FirestoreFields.pollAllowMultiple: allowMultiple,
      FirestoreFields.senderUid: senderUid,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
      FirestoreFields.reactions: <String, dynamic>{},
    });
    batch.update(_conversations(clubId).doc(conversationId), {
      FirestoreFields.lastMessageAt: FieldValue.serverTimestamp(),
      FirestoreFields.lastMessagePreview: preview.length > 120
          ? '${preview.substring(0, 117)}…'
          : preview,
      FirestoreFields.lastSenderUid: senderUid,
      if (senderFirstName != null && senderFirstName.trim().isNotEmpty)
        FirestoreFields.lastSenderFirstName: senderFirstName.trim(),
      if (senderRole != null && senderRole.trim().isNotEmpty)
        FirestoreFields.lastSenderRole: senderRole.trim(),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }

  /// Vote (ou retire le vote) sur une option de sondage.
  Future<void> votePollOption({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String optionId,
    required String uid,
  }) async {
    final ref = _messages(clubId, conversationId).doc(messageId);
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final data = snap.data() ?? {};
      if (data[FirestoreFields.type] != ChatMessageTypes.poll) {
        throw StateError('Pas un sondage');
      }
      if (data[FirestoreFields.deletedAt] != null) {
        throw StateError('Sondage supprimé');
      }

      final allowMultiple =
          data[FirestoreFields.pollAllowMultiple] as bool? ?? false;
      final rawVotes = data[FirestoreFields.pollVotes];
      final votes = <String, List<String>>{};
      if (rawVotes is Map) {
        for (final entry in rawVotes.entries) {
          if (entry.key is! String) continue;
          final list = entry.value;
          votes[entry.key as String] = list is List
              ? list.whereType<String>().toList()
              : <String>[];
        }
      }

      final currentlySelected = votes[optionId]?.contains(uid) ?? false;
      if (allowMultiple) {
        final list = List<String>.from(votes[optionId] ?? const []);
        if (currentlySelected) {
          list.remove(uid);
        } else {
          list.add(uid);
        }
        if (list.isEmpty) {
          votes.remove(optionId);
        } else {
          votes[optionId] = list;
        }
      } else {
        // Choix unique : retire l’uid partout, puis (re)pose sur l’option.
        for (final key in votes.keys.toList()) {
          final list = List<String>.from(votes[key] ?? const []);
          list.remove(uid);
          if (list.isEmpty) {
            votes.remove(key);
          } else {
            votes[key] = list;
          }
        }
        if (!currentlySelected) {
          votes[optionId] = [...(votes[optionId] ?? const []), uid];
        }
      }

      tx.update(ref, {FirestoreFields.pollVotes: votes});
    });
  }

  /// Toggle réaction emoji (ajoute ou retire l’uid).
  Future<void> toggleReaction({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String emoji,
    required String uid,
  }) async {
    final ref = _messages(clubId, conversationId).doc(messageId);
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final data = snap.data() ?? {};
      final raw = data[FirestoreFields.reactions];
      final reactions = <String, List<String>>{};
      if (raw is Map) {
        for (final e in raw.entries) {
          if (e.key is! String) continue;
          final list = e.value;
          reactions[e.key as String] = list is List
              ? list.whereType<String>().toList()
              : <String>[];
        }
      }
      final current = List<String>.from(reactions[emoji] ?? const []);
      if (current.contains(uid)) {
        current.remove(uid);
      } else {
        current.add(uid);
      }
      if (current.isEmpty) {
        reactions.remove(emoji);
      } else {
        reactions[emoji] = current;
      }
      tx.update(ref, {FirestoreFields.reactions: reactions});
    });
  }

  /// Mute / unmute.
  Future<void> setMuted({
    required String uid,
    required String clubId,
    required String conversationId,
    required bool muted,
  }) async {
    final id = ChatUserState.docId(clubId, conversationId);
    await _chatState(uid).doc(id).set({
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
    await _chatState(uid).doc(id).set({
      FirestoreFields.favorite: favorite,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  /// Trie l’inbox : favoris en tête, puis date du dernier message.
  static List<ChatConversation> sortInboxConversations(
    List<ChatConversation> conversations,
    Map<String, ChatUserState> chatStates,
  ) {
    final sorted = [...conversations];
    sorted.sort((a, b) {
      final aFav =
          chatStates[ChatUserState.docId(a.clubId, a.id)]?.favorite == true
              ? 1
              : 0;
      final bFav =
          chatStates[ChatUserState.docId(b.clubId, b.id)]?.favorite == true
              ? 1
              : 0;
      if (aFav != bFav) return bFav - aFav;
      final aAt = a.lastMessageAt?.millisecondsSinceEpoch ??
          a.createdAt?.millisecondsSinceEpoch ??
          0;
      final bAt = b.lastMessageAt?.millisecondsSinceEpoch ??
          b.createdAt?.millisecondsSinceEpoch ??
          0;
      return bAt.compareTo(aAt);
    });
    return sorted;
  }

  /// Marque la conversation comme lue.
  Future<void> markRead({
    required String uid,
    required String clubId,
    required String conversationId,
  }) async {
    final id = ChatUserState.docId(clubId, conversationId);
    await _chatState(uid).doc(id).set({
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
    await _conversations(clubId).doc(conversationId).update({
      FirestoreFields.titleOverride: titleOverride.trim(),
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
    final data = result.data;
    if (data is Map && data['conversationId'] is String) {
      return data['conversationId'] as String;
    }
    throw StateError('createCoachDm: réponse invalide');
  }

  /// Callable admin : canal catégorie.
  Future<String> createCategoryChannel({
    required String clubId,
    required String categoryKey,
    required String title,
    String writePolicy = ChatWritePolicies.adminsOnly,
  }) async {
    final callable =
        _functions.httpsCallable(cloudCallableName('createCategoryChannel'));
    final result = await callable.call(<String, dynamic>{
      'clubId': clubId,
      'categoryKey': categoryKey,
      'title': title,
      'writePolicy': writePolicy,
    });
    final data = result.data;
    if (data is Map && data['conversationId'] is String) {
      return data['conversationId'] as String;
    }
    throw StateError('createCategoryChannel: réponse invalide');
  }

  /// Retrouve une conv système par clé (ex. `team:{id}`).
  Future<String?> findConversationIdBySystemKey({
    required String clubId,
    required String systemKey,
  }) async {
    final snap = await _conversations(clubId)
        .where(FirestoreFields.systemKey, isEqualTo: systemKey)
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return null;
    return snap.docs.first.id;
  }

  /// Backfill chats système d’un club (équipes déjà existantes).
  Future<void> ensureClubChatSynced({required String clubId}) async {
    final callable =
        _functions.httpsCallable(cloudCallableName('ensureClubChatSynced'));
    await callable.call(<String, dynamic>{'clubId': clubId});
  }

  /// Backfill de tous les clubs où l’utilisateur est admin.
  Future<({int clubsSynced, int teamsSynced})> backfillMyAdminClubChats() async {
    final callable = _functions
        .httpsCallable(cloudCallableName('backfillMyAdminClubChats'));
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
    var id = await findConversationIdBySystemKey(
      clubId: clubId,
      systemKey: systemKey,
    );
    if (id != null) return id;
    await ensureClubChatSynced(clubId: clubId);
    return findConversationIdBySystemKey(
      clubId: clubId,
      systemKey: systemKey,
    );
  }
}
