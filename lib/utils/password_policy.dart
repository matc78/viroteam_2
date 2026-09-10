import 'package:viro_team_v2/copy/app_copy.dart';

/// Politique mot de passe ViroTeam (inscription + changement).
abstract final class PasswordPolicy {
  static const int minLength = 8;

  /// Texte d’aide affiché sous les champs mot de passe.
  static String get hint => AppCopy.auth.passwordHint;

  /// Retourne `null` si valide, sinon un message d’erreur en français.
  static String? validate(String? password) {
    if (password == null || password.isEmpty) {
      return AppCopy.auth.passwordRequired;
    }
    if (password.length < minLength) {
      return AppCopy.auth.passwordMinLength(minLength);
    }
    if (!_hasUppercase.hasMatch(password)) {
      return AppCopy.auth.passwordNeedUpper;
    }
    if (!_hasLowercase.hasMatch(password)) {
      return AppCopy.auth.passwordNeedLower;
    }
    if (!_hasDigit.hasMatch(password)) {
      return AppCopy.auth.passwordNeedDigit;
    }
    return null;
  }

  static bool isValid(String password) => validate(password) == null;

  static final RegExp _hasUppercase = RegExp(r'[A-ZÀ-ÖØ-Þ]');
  static final RegExp _hasLowercase = RegExp(r'[a-zà-öø-ÿ]');
  static final RegExp _hasDigit = RegExp(r'[0-9]');
}
