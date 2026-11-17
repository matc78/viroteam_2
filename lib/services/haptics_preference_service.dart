import 'package:shared_preferences/shared_preferences.dart';

/// Persistance locale du réglage « Vibrations » (activé par défaut) sur
/// l'appareil.
class HapticsPreferenceService {
  HapticsPreferenceService({SharedPreferences? preferences})
      : _preferences = preferences;

  SharedPreferences? _preferences;

  static const String _prefsKey = 'app_haptics_enabled_v1';

  Future<SharedPreferences> _prefs() async {
    return _preferences ??= await SharedPreferences.getInstance();
  }

  /// Réglage enregistré, lu de façon synchrone quand les préférences ont été
  /// préchargées au démarrage ; `true` sinon ou si absent.
  bool readSync() => _preferences?.getBool(_prefsKey) ?? true;

  /// Enregistre [enabled] comme choix de l'utilisateur.
  Future<void> write(bool enabled) async {
    final prefs = await _prefs();
    await prefs.setBool(_prefsKey, enabled);
  }
}
