import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/services/auth_exceptions.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Gestion du compte Auth (réauth + suppression), aligné sur le portail.
class AccountService {
  AccountService({
    FirebaseAuth? auth,
    FirebaseFirestore? firestore,
    GoogleSignIn? googleSignIn,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _db = firestore ?? appFirestore,
        _googleSignIn = googleSignIn ?? GoogleSignIn();

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;
  final GoogleSignIn _googleSignIn;

  /// Indique si le compte a le provider email / mot de passe.
  bool hasPasswordProvider(User user) =>
      user.providerData.any((p) => p.providerId == 'password');

  /// Indique si le compte a le provider Google.
  bool hasGoogleProvider(User user) =>
      user.providerData.any((p) => p.providerId == 'google.com');

  /// Réauthentifie l’utilisateur (mot de passe et/ou Google).
  Future<void> reauthenticate({
    required User user,
    String? password,
  }) async {
    if (hasPasswordProvider(user)) {
      final email = user.email?.trim();
      if (email == null || email.isEmpty) {
        throw StateError('E-mail manquant pour la réauthentification.');
      }
      final trimmedPassword = password?.trim() ?? '';
      if (trimmedPassword.isEmpty) {
        throw StateError('Mot de passe actuel requis.');
      }
      final credential = EmailAuthProvider.credential(
        email: email,
        password: trimmedPassword,
      );
      await user.reauthenticateWithCredential(credential);
      return;
    }

    if (hasGoogleProvider(user)) {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        throw const AuthCanceledException();
      }
      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      await user.reauthenticateWithCredential(credential);
      return;
    }

    throw StateError('Aucun moyen de réauthentification disponible.');
  }

  /// Désactive le profil Firestore puis supprime le compte Auth.
  Future<void> deleteAccount({String? currentPassword}) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw StateError('Aucun utilisateur connecté.');
    }

    await reauthenticate(user: user, password: currentPassword);

    await _db.collection(ProjectConfig.usersCollection).doc(user.uid).set(
      {
        FirestoreFields.flags: {
          FirestoreFields.disabled: true,
        },
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );

    await user.delete();
    await _googleSignIn.signOut();
  }
}
