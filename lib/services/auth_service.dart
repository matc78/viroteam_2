import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:viro_team_v2/services/apple_sign_in.dart';
import 'package:viro_team_v2/services/auth_exceptions.dart';
import 'package:viro_team_v2/utils/password_policy.dart';

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
  Future<UserCredential> signInWithGoogle() async {
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
      return await _auth.signInWithCredential(credential);
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
  /// tout de suite dans `displayName` pour que le pré-remplissage du profil
  /// (et les relances) le retrouvent. L’e-mail peut être un relais
  /// `@privaterelay.appleid.com` : Firebase le porte déjà sur le `User`.
  Future<UserCredential> signInWithApple() async {
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
      } catch (_) {
        // Le nom reste vide : l’écran « compléter le profil » le demandera.
      }
    }
    return credential;
  }

  Future<void> signOut() async {
    await Future.wait([
      _auth.signOut(),
      _googleSignIn.signOut(),
    ]);
  }
}
