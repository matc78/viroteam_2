import 'package:shared_preferences/shared_preferences.dart';

/// Choix de l'utilisateur sur la mesure d'audience (PostHog).
enum AnalyticsConsent {
  /// Pas encore demandé : aucun envoi.
  unknown,
  granted,
  denied,
}

/// Persistance locale du consentement à la mesure d'audience (par appareil).
class AnalyticsConsentService {
  AnalyticsConsentService({SharedPreferences? preferences})
      : _preferences = preferences;

  SharedPreferences? _preferences;

  static const String _prefsKey = 'analytics_consent_v1';

  Future<SharedPreferences> _prefs() async {
    return _preferences ??= await SharedPreferences.getInstance();
  }

  /// Choix enregistré, lu de façon synchrone quand les préférences ont été
  /// préchargées au démarrage ; [AnalyticsConsent.unknown] sinon.
  AnalyticsConsent readSync() => _decode(_preferences?.getString(_prefsKey));

  /// Enregistre [consent] comme choix de l'utilisateur.
  Future<void> write(AnalyticsConsent consent) async {
    final prefs = await _prefs();
    await prefs.setString(_prefsKey, consent.name);
  }

  static AnalyticsConsent _decode(String? stored) {
    return AnalyticsConsent.values.firstWhere(
      (consent) => consent.name == stored,
      orElse: () => AnalyticsConsent.unknown,
    );
  }
}
