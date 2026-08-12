/// Connexion annulée par l'utilisateur (ex. popup Google fermée).
class AuthCanceledException implements Exception {
  const AuthCanceledException();
}

/// L'e-mail est déjà associé à un compte mot de passe (pas Google).
class EmailUsedWithPasswordException implements Exception {
  const EmailUsedWithPasswordException([this.email]);

  final String? email;
}
