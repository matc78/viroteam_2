import 'package:shared_preferences/shared_preferences.dart';

/// Identifiants des bannières portail masquables par écran.
abstract final class PortalBannerIds {
  static const planning = 'planning';
  static const members = 'members';
  static const fees = 'fees';
}

/// Persistance locale du masquage des bannières « espace club » (par utilisateur + écran).
class PortalBannerPrefsService {
  PortalBannerPrefsService({SharedPreferences? preferences})
      : _preferences = preferences;

  SharedPreferences? _preferences;

  static String _prefsKey(String userId, String bannerId) =>
      'portal_banner_dismissed_v1_${userId}_$bannerId';

  Future<SharedPreferences> _prefs() async {
    return _preferences ??= await SharedPreferences.getInstance();
  }

  /// Indique si la bannière [bannerId] a été masquée par [userId].
  Future<bool> isDismissed({
    required String userId,
    required String bannerId,
  }) async {
    final prefs = await _prefs();
    return prefs.getBool(_prefsKey(userId, bannerId)) ?? false;
  }

  /// Enregistre le masquage définitif de la bannière [bannerId] pour [userId].
  Future<void> dismiss({
    required String userId,
    required String bannerId,
  }) async {
    final prefs = await _prefs();
    await prefs.setBool(_prefsKey(userId, bannerId), true);
  }
}
