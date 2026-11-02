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
    required FirebaseStorage storage,
    required ChatPaths paths,
  })  : _storage = storage,
        _paths = paths;

  final FirebaseStorage _storage;
  final ChatPaths _paths;

  /// Alloue un id Firestore pour un envoi optimiste (même id côté UI / serveur).
  String allocateMessageId({
    required String clubId,
    required String conversationId,
  }) =>
      _paths.messages(clubId, conversationId).doc().id;

  /// Envoie un message texte (l'aperçu inbox est écrit par le serveur).
  Future<String> sendTextMessage({
    required String clubId,
    required String conversationId,
    required String senderUid,
    required String text,
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

    await ref.set({
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
    return ref.id;
  }

  /// Upload photo puis crée le message image (full + thumb).
  Future<String> sendImageMessage({
    required String clubId,
    required String conversationId,
    required String senderUid,
    required Uint8List bytes,
    String contentType = 'image/jpeg',
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
    await ref.set({
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
    return ref.id;
  }

  /// Soft-delete d’un message : le contenu est retiré dans la même écriture
  /// (exigé par les règles), le média Storage est supprimé par le serveur.
  Future<void> softDeleteMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String deletedByUid,
  }) async {
    await _paths.messages(clubId, conversationId).doc(messageId).update({
      FirestoreFields.deletedAt: FieldValue.serverTimestamp(),
      FirestoreFields.deletedByUid: deletedByUid,
      for (final key in chatMessageContentFields) key: FieldValue.delete(),
    });
  }

  /// Modifie le texte d’un message (l'aperçu suit côté serveur).
  Future<void> editTextMessage({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String text,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    await _paths.messages(clubId, conversationId).doc(messageId).update({
      FirestoreFields.text: trimmed,
      FirestoreFields.editedAt: FieldValue.serverTimestamp(),
    });
  }
}
