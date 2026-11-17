import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persistance locale de l'intention d'inscription (`founder` ou `join`).
///
/// Sans elle, un invité qui relance l'app avant d'avoir rejoint son club
/// retombait sur l'intention par défaut (fondateur) et le routeur l'envoyait
/// sur la création de club.
class SignUpIntentPreferenceService {
  SignUpIntentPreferenceService({SharedPreferences? preferences})
      : _preferences = preferences;

  SharedPreferences? _preferences;

  static const String _prefsKey = 'sign_up_intent_v1';

  /// Valeur enregistrée pour une intention « rejoindre un club ».
  static const String joinValue = 'join';

  /// Valeur enregistrée pour une intention « créer un club ».
  static const String founderValue = 'founder';

  Future<SharedPreferences> _prefs() async {
    return _preferences ??= await SharedPreferences.getInstance();
  }

  /// Intention enregistrée (`join` / `founder`), lue de façon synchrone quand
  /// les préférences ont été préchargées au démarrage ; `null` sinon ou si
  /// absente.
  String? readSync() => _preferences?.getString(_prefsKey);

  /// Enregistre [value] (`join` / `founder`). Best-effort : un échec
  /// d'écriture ne bloque pas le parcours d'inscription.
  Future<void> write(String value) async {
    try {
      final prefs = await _prefs();
      await prefs.setString(_prefsKey, value);
    } catch (error) {
      debugPrint('SignUpIntentPreferenceService.write: $error');
    }
  }
}
