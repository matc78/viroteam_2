import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/services/auth_exceptions.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';
import 'package:viro_team_v2/utils/password_policy.dart';

/// Échec de la suppression de compte côté serveur (message FR affichable).
class AccountDeletionException implements Exception {
  const AccountDeletionException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Gestion du compte Auth (réauth + suppression), aligné sur le portail.
class AccountService {
  AccountService({
    FirebaseAuth? auth,
    FirebaseFirestore? firestore,
    GoogleSignIn? googleSignIn,
    FirebaseFunctions? functions,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _db = firestore ?? appFirestore,
        _googleSignIn = googleSignIn ?? GoogleSignIn(),
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;
  final GoogleSignIn _googleSignIn;
  final FirebaseFunctions _functions;

  /// Indique si le compte a le provider email / mot de passe.
  static bool userHasPasswordProvider(User user) =>
      user.providerData.any((p) => p.providerId == 'password');

  /// Indique si le compte a le provider Google.
  static bool userHasGoogleProvider(User user) =>
      user.providerData.any((p) => p.providerId == 'google.com');

  /// Libellés FR des providers Auth liés au compte.
  static List<String> authProviderLabels(User user) {
    final labels = <String>[];
    if (userHasPasswordProvider(user)) {
      labels.add('Email / mot de passe');
    }
    if (userHasGoogleProvider(user)) {
      labels.add('Google');
    }
    if (labels.isEmpty) labels.add('Inconnu');
    return labels;
  }

  /// Met à jour l’e-mail Auth + Firestore après réauth.
  Future<void> changeEmail({
    required String newEmail,
    String? currentPassword,
  }) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw StateError('Aucun utilisateur connecté.');
    }

    final trimmedEmail = newEmail.trim();
    if (trimmedEmail.isEmpty) {
      throw StateError('Nouvel e-mail requis.');
    }

    await reauthenticate(user: user, password: currentPassword);
    await user.verifyBeforeUpdateEmail(trimmedEmail);

    // Sync Firestore tout de suite pour l’affichage in-app (Auth après validation du lien).
    await _db.collection(ProjectConfig.usersCollection).doc(user.uid).set(
      {
        FirestoreFields.email: trimmedEmail,
        FirestoreFields.emailNorm: trimmedEmail.toLowerCase(),
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
  }

  /// Change le mot de passe (provider password uniquement).
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw StateError('Aucun utilisateur connecté.');
    }
    if (!userHasPasswordProvider(user)) {
      throw StateError('Ce compte n’utilise pas de mot de passe.');
    }
    final policyError = PasswordPolicy.validate(newPassword);
    if (policyError != null) {
      throw StateError(policyError);
    }

    await reauthenticate(user: user, password: currentPassword);
    await user.updatePassword(newPassword.trim());
  }

  /// Réauthentifie l’utilisateur (mot de passe et/ou Google).
  Future<void> reauthenticate({
    required User user,
    String? password,
  }) async {
    if (userHasPasswordProvider(user)) {
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

    if (userHasGoogleProvider(user)) {
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

  /// Supprime le compte : réauth, callable `deleteMyAccount` (anonymisation
  /// des fiches + suppression Auth côté serveur), puis déconnexion locale
  /// Google + Firebase. Lève [AccountDeletionException] (message FR) si la
  /// callable échoue.
  Future<void> deleteAccount({String? currentPassword}) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw StateError('Aucun utilisateur connecté.');
    }

    await reauthenticate(user: user, password: currentPassword);

    final callable =
        _functions.httpsCallable(cloudCallableName('deleteMyAccount'));
    try {
      await callable.call(<String, dynamic>{});
    } on FirebaseFunctionsException catch (error) {
      throw AccountDeletionException(
        callableErrorMessage(
          error,
          fallback: 'Suppression du compte impossible. Réessaie plus tard.',
        ),
      );
    }

    // Le compte Auth n'existe plus côté serveur : on nettoie la session locale.
    await Future.wait<void>([
      _googleSignIn.signOut(),
      _auth.signOut(),
    ]);
  }
}
