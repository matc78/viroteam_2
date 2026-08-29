/// Politique mot de passe ViroTeam (inscription + changement).
abstract final class PasswordPolicy {
  static const int minLength = 8;

  /// Texte d’aide affiché sous les champs mot de passe.
  static const String hint =
      '8 caractères minimum, avec une majuscule, une minuscule et un chiffre.';

  /// Retourne `null` si valide, sinon un message d’erreur en français.
  static String? validate(String? password) {
    if (password == null || password.isEmpty) {
      return 'Le mot de passe est requis.';
    }
    if (password.length < minLength) {
      return 'Au moins $minLength caractères.';
    }
    if (!_hasUppercase.hasMatch(password)) {
      return 'Au moins une majuscule.';
    }
    if (!_hasLowercase.hasMatch(password)) {
      return 'Au moins une minuscule.';
    }
    if (!_hasDigit.hasMatch(password)) {
      return 'Au moins un chiffre.';
    }
    return null;
  }

  static bool isValid(String password) => validate(password) == null;

  static final RegExp _hasUppercase = RegExp(r'[A-ZÀ-ÖØ-Þ]');
  static final RegExp _hasLowercase = RegExp(r'[a-zà-öø-ÿ]');
  static final RegExp _hasDigit = RegExp(r'[0-9]');
}
