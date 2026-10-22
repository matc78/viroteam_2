import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persistance locale du thème choisi (Système / Clair / Sombre) sur l'appareil.
class ThemePreferenceService {
  ThemePreferenceService({SharedPreferences? preferences})
      : _preferences = preferences;

  SharedPreferences? _preferences;

  static const String _prefsKey = 'app_theme_mode_v1';

  Future<SharedPreferences> _prefs() async {
    return _preferences ??= await SharedPreferences.getInstance();
  }

  /// Mode enregistré, lu de façon synchrone quand les préférences ont été
  /// préchargées au démarrage ; [ThemeMode.system] sinon ou si absent.
  ThemeMode readSync() => _decode(_preferences?.getString(_prefsKey));

  /// Mode enregistré ([ThemeMode.system] si aucun choix).
  Future<ThemeMode> read() async {
    final prefs = await _prefs();
    return _decode(prefs.getString(_prefsKey));
  }

  /// Enregistre [mode] comme choix de l'utilisateur.
  Future<void> write(ThemeMode mode) async {
    final prefs = await _prefs();
    await prefs.setString(_prefsKey, mode.name);
  }

  static ThemeMode _decode(String? stored) {
    return ThemeMode.values.firstWhere(
      (mode) => mode.name == stored,
      orElse: () => ThemeMode.system,
    );
  }
}
