import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/services/notification_permission_service.dart';

/// Rythme de la pré-demande de permission notifications (sheet maison
/// affichée avant la popup système).
///
/// Une fois par session d'app au plus, espacée de [minInterval], et pas plus
/// de [maxShows] fois au total : au-delà, l'utilisateur garde la main via
/// Paramètres > Notifications.
class NotificationSoftAskService {
  NotificationSoftAskService({SharedPreferences? preferences})
    : _preferences = preferences;

  SharedPreferences? _preferences;
  bool _shownThisSession = false;

  static const maxShows = 3;
  static const minInterval = Duration(days: 7);

  static const _countKey = 'notif_soft_ask_count_v1';
  static const _lastShownKey = 'notif_soft_ask_last_shown_ms_v1';

  Future<SharedPreferences> _prefs() async {
    return _preferences ??= await SharedPreferences.getInstance();
  }

  /// `true` si la sheet peut être proposée maintenant pour ce [status].
  Future<bool> shouldShow(NotificationPermissionStatus status) async {
    // `--dart-define=SKIP_PUSH_PERMISSION=true` : aucune demande de
    // permission (captures d'écran store). Défaut : false.
    const skipPermission = bool.fromEnvironment('SKIP_PUSH_PERMISSION');
    if (skipPermission || _shownThisSession) return false;
    final prefs = await _prefs();
    final lastShownMs = prefs.getInt(_lastShownKey);
    return shouldShowSoftAsk(
      status: status,
      shownCount: prefs.getInt(_countKey) ?? 0,
      lastShownAt: lastShownMs == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(lastShownMs),
      now: DateTime.now(),
    );
  }

  /// Enregistre un affichage de la sheet.
  Future<void> markShown() async {
    _shownThisSession = true;
    final prefs = await _prefs();
    await prefs.setInt(_countKey, (prefs.getInt(_countKey) ?? 0) + 1);
    await prefs.setInt(_lastShownKey, DateTime.now().millisecondsSinceEpoch);
  }
}

/// Règle pure de la pré-demande (voir [NotificationSoftAskService]).
///
/// Seulement si la popup système peut encore s'afficher (`notDetermined`,
/// `denied` Android) : un refus définitif (`blocked`) se rattrape via le
/// bandeau de Paramètres > Notifications, pas par la sheet.
@visibleForTesting
bool shouldShowSoftAsk({
  required NotificationPermissionStatus status,
  required int shownCount,
  required DateTime? lastShownAt,
  required DateTime now,
}) {
  if (status != NotificationPermissionStatus.notDetermined &&
      status != NotificationPermissionStatus.denied) {
    return false;
  }
  if (shownCount >= NotificationSoftAskService.maxShows) return false;
  if (lastShownAt == null) return true;
  return now.difference(lastShownAt) >= NotificationSoftAskService.minInterval;
}
