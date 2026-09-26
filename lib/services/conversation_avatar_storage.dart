import 'dart:typed_data';

import 'package:firebase_storage/firebase_storage.dart';

/// Upload avatar d’une discussion de groupe vers Firebase Storage.
///
/// Path aligné médias chat : `clubs/{clubId}/chat/{convId}/{uid}/avatar.jpg`
/// (règles Storage owner-only ; affichage via URL tokenisée).
class ConversationAvatarStorage {
  ConversationAvatarStorage({FirebaseStorage? storage})
      : _storage = storage ?? FirebaseStorage.instance;

  final FirebaseStorage _storage;

  /// Chemin Storage de l’avatar de conversation.
  static String storagePath({
    required String clubId,
    required String conversationId,
    required String uid,
  }) =>
      'clubs/$clubId/chat/$conversationId/$uid/avatar.jpg';

  /// Envoie l’image et retourne l’URL de téléchargement.
  Future<String> uploadAvatar({
    required String clubId,
    required String conversationId,
    required String uid,
    required Uint8List bytes,
    String contentType = 'image/jpeg',
  }) async {
    final storageRef = _storage.ref().child(
          storagePath(
            clubId: clubId,
            conversationId: conversationId,
            uid: uid,
          ),
        );
    await storageRef.putData(
      bytes,
      SettableMetadata(contentType: contentType),
    );
    return storageRef.getDownloadURL();
  }
}
