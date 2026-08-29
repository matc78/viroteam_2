import 'dart:typed_data';

import 'package:firebase_storage/firebase_storage.dart';

/// Upload avatar utilisateur vers Firebase Storage (aligné portail).
class UserAvatarStorage {
  UserAvatarStorage({FirebaseStorage? storage})
      : _storage = storage ?? FirebaseStorage.instance;

  final FirebaseStorage _storage;

  /// Chemin Storage de l’avatar (`users/{uid}/avatar.jpg`).
  static String storagePath(String uid) => 'users/$uid/avatar.jpg';

  /// Envoie l’image et retourne l’URL de téléchargement.
  Future<String> uploadAvatar({
    required String uid,
    required Uint8List bytes,
    String contentType = 'image/jpeg',
  }) async {
    final storageRef = _storage.ref().child(storagePath(uid));
    await storageRef.putData(
      bytes,
      SettableMetadata(contentType: contentType),
    );
    return storageRef.getDownloadURL();
  }
}
