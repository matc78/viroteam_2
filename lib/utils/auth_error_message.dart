import 'package:firebase_auth/firebase_auth.dart';

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
              : 'Une erreur est survenue.');
    }
    return 'Une erreur est survenue.';
  }

  static String? _forCode(String code) {
    switch (code) {
      case 'invalid-email':
      case 'auth/invalid-email':
        return 'Adresse e-mail invalide.';
      case 'user-disabled':
      case 'auth/user-disabled':
        return 'Ce compte est désactivé.';
      case 'user-not-found':
      case 'auth/user-not-found':
      case 'wrong-password':
      case 'auth/wrong-password':
      case 'invalid-credential':
      case 'auth/invalid-credential':
        return 'E-mail ou mot de passe incorrect.';
      case 'email-already-in-use':
      case 'auth/email-already-in-use':
        return 'Un compte existe déjà avec cet e-mail.';
      case 'weak-password':
      case 'auth/weak-password':
        return 'Mot de passe trop faible (8 caractères minimum).';
      case 'too-many-requests':
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Réessaie plus tard.';
      case 'network-request-failed':
      case 'auth/network-request-failed':
        return 'Problème réseau. Vérifie ta connexion.';
      case 'account-exists-with-different-credential':
      case 'auth/account-exists-with-different-credential':
        return 'Un compte existe déjà avec cet e-mail. Connecte-toi avec ton mot de passe.';
      case 'requires-recent-login':
      case 'auth/requires-recent-login':
        return 'Reconnecte-toi pour confirmer cette action.';
      default:
        return null;
    }
  }
}
