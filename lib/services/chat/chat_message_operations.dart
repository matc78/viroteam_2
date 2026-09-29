import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/services/chat/chat_helpers.dart';
import 'package:viro_team_v2/services/chat/chat_paths.dart';
import 'package:viro_team_v2/utils/chat_image_prepare.dart';

/// Regroupe les mutations liées aux messages simples du chat.
class ChatMessageOperations {
  /// Crée le module d’écriture de messages.
  ChatMessageOperations({
    required FirebaseFirestore firestore,
    required FirebaseStorage storage,
    required ChatPaths paths,
  })  : _db = firestore,
        _storage = storage,
        _paths = paths;

  final FirebaseFirestore _db;
  final FirebaseStorage _storage;
  final ChatPaths _paths;

  /// Alloue un id Firestore pour un envoi optimiste (même id côté UI / serveur).
  String allocateMessageId({
    required String clubId,
    required String conversationId,
  }) =>
      _paths.messages(clubId, conversationId).doc().id;

  /// Envoie un message texte et met à jour le preview conversation.
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
  }) async {
    final trimmed = text.trimRight();
    if (trimmed.trim().isEmpty) {
      throw ArgumentError('text empty');
    }

    final clientId = trimToNull(clientMessageId);
    final ref = clientId != null
        ? _paths.messages(clubId, conversationId).doc(clientId)
        : _paths.messages(clubId, conversationId).doc();
    final batch = _db.batch();

    batch.set(ref, {
      FirestoreFields.type: ChatMessageTypes.text,
      FirestoreFields.text: trimmed,
      FirestoreFields.senderUid: senderUid,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
      FirestoreFields.reactions: <String, dynamic>{},
      ...buildReplyFields(
        replyToMessageId: replyToMessageId,
        replyToText: replyToText,
        replyToSenderUid: replyToSenderUid,
      ),
    });
    batch.update(_paths.conversations(clubId).doc(conversationId), {
      FirestoreFields.lastMessageAt: FieldValue.serverTimestamp(),
      FirestoreFields.lastMessagePreview: truncateChatText(
        trimmed,
        maxLength: 120,
      ),
      FirestoreFields.lastSenderUid: senderUid,
      if (trimToNull(senderFirstName) != null)
        FirestoreFields.lastSenderFirstName: trimToNull(senderFirstName),
      if (trimToNull(senderRole) != null)
        FirestoreFields.lastSenderRole: trimToNull(senderRole),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return ref.id;
  }

  /// Upload photo puis crée le message image (full + thumb).
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
  }) async {
    final prepared = await prepareChatImageUpload(bytes);
    final clientId = trimToNull(clientMessageId);
    final ref = clientId != null
        ? _paths.messages(clubId, conversationId).doc(clientId)
        : _paths.messages(clubId, conversationId).doc();

    // Segment uid : Storage rules ne peuvent pas lire v2-dev/v2-prod.
    final path = 'clubs/$clubId/chat/$conversationId/$senderUid/${ref.id}.jpg';
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
      ...buildReplyFields(
        replyToMessageId: replyToMessageId,
        replyToText: replyToText,
        replyToSenderUid: replyToSenderUid,
      ),
    });
    batch.update(_paths.conversations(clubId).doc(conversationId), {
      FirestoreFields.lastMessageAt: FieldValue.serverTimestamp(),
      FirestoreFields.lastMessagePreview: '📷 Photo',
      FirestoreFields.lastSenderUid: senderUid,
      if (trimToNull(senderFirstName) != null)
        FirestoreFields.lastSenderFirstName: trimToNull(senderFirstName),
      if (trimToNull(senderRole) != null)
        FirestoreFields.lastSenderRole: trimToNull(senderRole),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return ref.id;
  }

  /// Soft-delete d’un message.
  Future<void> softDeleteMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String deletedByUid,
  }) async {
    await _paths.messages(clubId, conversationId).doc(messageId).update({
      FirestoreFields.deletedAt: FieldValue.serverTimestamp(),
      FirestoreFields.deletedByUid: deletedByUid,
    });
  }

  /// Modifie le texte d’un message et le preview s’il est le plus récent.
  Future<void> editTextMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String text,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    final latestSnap = await _paths
        .messages(clubId, conversationId)
        .orderBy(FirestoreFields.createdAt, descending: true)
        .limit(1)
        .get();
    final isLatest =
        latestSnap.docs.isNotEmpty && latestSnap.docs.first.id == messageId;

    final batch = _db.batch();
    batch.update(_paths.messages(clubId, conversationId).doc(messageId), {
      FirestoreFields.text: trimmed,
      FirestoreFields.editedAt: FieldValue.serverTimestamp(),
    });
    if (isLatest) {
      batch.update(_paths.conversations(clubId).doc(conversationId), {
        FirestoreFields.lastMessagePreview: truncateChatText(
          trimmed,
          maxLength: 120,
        ),
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}
