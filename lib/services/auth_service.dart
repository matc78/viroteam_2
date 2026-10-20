import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:viro_team_v2/services/apple_sign_in.dart';
import 'package:viro_team_v2/services/auth_exceptions.dart';
import 'package:viro_team_v2/utils/password_policy.dart';

/// Résultat d’une connexion sociale, avec noms fournis par le provider.
class SocialSignInResult {
  const SocialSignInResult({
    required this.credential,
    this.firstName,
    this.lastName,
  });

  final UserCredential credential;
  final String? firstName;
  final String? lastName;

  /// Utilisateur Firebase Auth après connexion.
  User? get user => credential.user;
}

class AuthService {
  AuthService({
    FirebaseAuth? auth,
    GoogleSignIn? googleSignIn,
    AppleSignInHelper? appleSignIn,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _googleSignIn = googleSignIn ?? GoogleSignIn(),
        _appleSignIn = appleSignIn ?? const AppleSignInHelper();

  final FirebaseAuth _auth;
  final GoogleSignIn _googleSignIn;
  final AppleSignInHelper _appleSignIn;

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  Future<UserCredential> signInWithEmail({
    required String email,
    required String password,
  }) {
    return _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<UserCredential> signUpWithEmail({
    required String email,
    required String password,
  }) {
    final policyError = PasswordPolicy.validate(password);
    if (policyError != null) {
      throw StateError(policyError);
    }
    return _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  /// Connexion via Google. Lance [EmailUsedWithPasswordException] si l'e-mail
  /// est déjà lié à un compte mot de passe, [AuthCanceledException] si annulé.
  Future<SocialSignInResult> signInWithGoogle() async {
    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) {
      throw const AuthCanceledException();
    }

    final googleAuth = await googleUser.authentication;
    final idToken = googleAuth.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw StateError('Jeton Google indisponible. Réessaie.');
    }
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: idToken,
    );

    try {
      final userCredential = await _auth.signInWithCredential(credential);
      final names = _splitDisplayName(googleUser.displayName);
      return SocialSignInResult(
        credential: userCredential,
        firstName: names.$1.isNotEmpty ? names.$1 : null,
        lastName: names.$2.isNotEmpty ? names.$2 : null,
      );
    } on FirebaseAuthException catch (error) {
      if (error.code == 'account-exists-with-different-credential') {
        throw EmailUsedWithPasswordException(googleUser.email);
      }
      rethrow;
    }
  }

  /// Connexion via Apple (iOS / macOS). Mêmes exceptions que Google.
  ///
  /// Apple ne renvoie le nom qu’à la première autorisation : on le pousse
  /// tout de suite dans `displayName` (avec `reload`) et on le renvoie dans
  /// [SocialSignInResult] pour le pré-remplissage du profil. L’e-mail peut
  /// être un relais `@privaterelay.appleid.com`.
  Future<SocialSignInResult> signInWithApple() async {
    final apple = await _appleSignIn.authorize();

    final UserCredential credential;
    try {
      credential = await _auth.signInWithCredential(apple.credential);
    } on FirebaseAuthException catch (error) {
      if (error.code == 'account-exists-with-different-credential') {
        throw EmailUsedWithPasswordException(apple.email);
      }
      rethrow;
    }

    final user = credential.user;
    final appleName = apple.displayName;
    if (user != null &&
        appleName.isNotEmpty &&
        (user.displayName?.trim().isEmpty ?? true)) {
      try {
        await user.updateDisplayName(appleName);
        await user.reload();
      } catch (_) {
        // Le nom reste vide : l’écran « confirmer le profil » le demandera.
      }
    }

    return SocialSignInResult(
      credential: credential,
      firstName: apple.firstName?.trim().isNotEmpty == true
          ? apple.firstName!.trim()
          : null,
      lastName: apple.lastName?.trim().isNotEmpty == true
          ? apple.lastName!.trim()
          : null,
    );
  }

  /// Envoie l’e-mail Firebase de réinitialisation du mot de passe.
  Future<void> sendPasswordResetEmail({required String email}) {
    return _auth.sendPasswordResetEmail(email: email.trim());
  }

  Future<void> signOut() async {
    await Future.wait([
      _auth.signOut(),
      _googleSignIn.signOut(),
    ]);
  }

  (String, String) _splitDisplayName(String? displayName) {
    final trimmed = displayName?.trim() ?? '';
    if (trimmed.isEmpty) return ('', '');
    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length == 1) return (parts.first, '');
    return (parts.first, parts.sublist(1).join(' '));
  }
}
