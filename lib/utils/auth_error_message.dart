import 'package:firebase_auth/firebase_auth.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Messages d’erreur Auth Firebase en français (aligné portail).
abstract final class AuthErrorMessage {
  /// Convertit une erreur Auth/Firebase en message utilisateur FR.
  static String from(Object? error) {
    if (error is StateError && error.message.isNotEmpty) {
      return error.message;
    }
    if (error is FirebaseAuthException) {
      return _forCode(error.code) ??
          (error.message?.trim().isNotEmpty == true
              ? error.message!.trim()
              : AppCopy.common.errorGeneric);
    }
    return AppCopy.common.errorGeneric;
  }

  /// Message d’erreur pour le reset mot de passe, ou `null` si succès neutre.
  ///
  /// `user-not-found` → `null` (anti-énumération : même message que succès).
  /// Les erreurs « credentials » ne sont jamais renvoyées dans ce contexte.
  static String? forPasswordReset(Object? error) {
    if (error is FirebaseAuthException) {
      final code = error.code;
      if (code == 'user-not-found' || code == 'auth/user-not-found') {
        return null;
      }
      return _forPasswordResetCode(code) ?? AppCopy.auth.forgotPasswordFailed;
    }
    if (error is StateError && error.message.isNotEmpty) {
      return error.message;
    }
    return AppCopy.auth.forgotPasswordFailed;
  }

  static String? _forPasswordResetCode(String code) {
    switch (code) {
      case 'invalid-email':
      case 'auth/invalid-email':
        return AppCopy.auth.authErrorInvalidEmail;
      case 'user-disabled':
      case 'auth/user-disabled':
        return AppCopy.auth.authErrorUserDisabled;
      case 'too-many-requests':
      case 'auth/too-many-requests':
        return AppCopy.auth.authErrorTooManyRequests;
      case 'network-request-failed':
      case 'auth/network-request-failed':
        return AppCopy.auth.authErrorNetworkFailed;
      default:
        return null;
    }
  }

  static String? _forCode(String code) {
    switch (code) {
      case 'invalid-email':
      case 'auth/invalid-email':
        return AppCopy.auth.authErrorInvalidEmail;
      case 'user-disabled':
      case 'auth/user-disabled':
        return AppCopy.auth.authErrorUserDisabled;
      case 'user-not-found':
      case 'auth/user-not-found':
      case 'wrong-password':
      case 'auth/wrong-password':
      case 'invalid-credential':
      case 'auth/invalid-credential':
        return AppCopy.auth.authErrorWrongCredentials;
      case 'email-already-in-use':
      case 'auth/email-already-in-use':
        return AppCopy.auth.authErrorEmailAlreadyInUse;
      case 'weak-password':
      case 'auth/weak-password':
        return AppCopy.auth.authErrorWeakPassword;
      case 'too-many-requests':
      case 'auth/too-many-requests':
        return AppCopy.auth.authErrorTooManyRequests;
      case 'network-request-failed':
      case 'auth/network-request-failed':
        return AppCopy.auth.authErrorNetworkFailed;
      case 'account-exists-with-different-credential':
      case 'auth/account-exists-with-different-credential':
        return AppCopy.auth.authErrorAccountExistsDifferentCredential;
      case 'requires-recent-login':
      case 'auth/requires-recent-login':
        return AppCopy.auth.authErrorRequiresRecentLogin;
      default:
        return null;
    }
  }
}
