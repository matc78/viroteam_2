import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Derniers classements consultés par un compte sur l'appareil.
class StandingsLastViewed {
  const StandingsLastViewed({
    this.clubId,
    this.teamId,
    this.teamByClub = const {},
  });

  /// Club et équipe du dernier classement ouvert.
  final String? clubId;
  final String? teamId;

  /// Dernière équipe consultée dans chaque club.
  final Map<String, String> teamByClub;

  /// Copie après consultation de [teamId] dans [clubId].
  StandingsLastViewed record(String clubId, String teamId) =>
      StandingsLastViewed(
        clubId: clubId,
        teamId: teamId,
        teamByClub: {...teamByClub, clubId: teamId},
      );
}

/// Persistance locale (par compte) des derniers classements consultés :
/// la coupe de la home rouvre le dernier, la barre des clubs retrouve
/// l'équipe vue dans chaque club.
class StandingsPreferenceService {
  StandingsPreferenceService({SharedPreferences? preferences})
    : _preferences = preferences;

  SharedPreferences? _preferences;

  static const String _prefsKeyPrefix = 'standings_last_viewed_v1_';
  static const String _clubKey = 'club';
  static const String _teamKey = 'team';
  static const String _byClubKey = 'byClub';

  Future<SharedPreferences> _prefs() async {
    return _preferences ??= await SharedPreferences.getInstance();
  }

  /// Consultations de [uid], lues de façon synchrone quand les préférences
  /// ont été préchargées au démarrage ; vide sinon ou si illisible.
  StandingsLastViewed readSync(String uid) {
    final raw = _preferences?.getString('$_prefsKeyPrefix$uid');
    if (raw == null) return const StandingsLastViewed();
    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      final byClub = data[_byClubKey] as Map<String, dynamic>? ?? const {};
      return StandingsLastViewed(
        clubId: data[_clubKey] as String?,
        teamId: data[_teamKey] as String?,
        teamByClub: {
          for (final entry in byClub.entries)
            if (entry.value is String) entry.key: entry.value as String,
        },
      );
    } on Object {
      return const StandingsLastViewed();
    }
  }

  /// Enregistre [lastViewed] pour [uid].
  Future<void> write(String uid, StandingsLastViewed lastViewed) async {
    final prefs = await _prefs();
    await prefs.setString(
      '$_prefsKeyPrefix$uid',
      jsonEncode({
        _clubKey: lastViewed.clubId,
        _teamKey: lastViewed.teamId,
        _byClubKey: lastViewed.teamByClub,
      }),
    );
  }
}
