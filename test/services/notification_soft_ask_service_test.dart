import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/services/notification_permission_service.dart';
import 'package:viro_team_v2/services/notification_soft_ask_service.dart';

void main() {
  final now = DateTime(2026, 10, 19, 12);

  group('shouldShowSoftAsk', () {
    test('jamais si la permission est déjà accordée', () {
      expect(
        shouldShowSoftAsk(
          status: NotificationPermissionStatus.granted,
          shownCount: 0,
          lastShownAt: null,
          now: now,
        ),
        isFalse,
      );
    });

    test('jamais si la permission est bloquée (réglages uniquement)', () {
      expect(
        shouldShowSoftAsk(
          status: NotificationPermissionStatus.blocked,
          shownCount: 0,
          lastShownAt: null,
          now: now,
        ),
        isFalse,
      );
    });

    test('première fois : oui', () {
      expect(
        shouldShowSoftAsk(
          status: NotificationPermissionStatus.notDetermined,
          shownCount: 0,
          lastShownAt: null,
          now: now,
        ),
        isTrue,
      );
    });

    test('respecte l’intervalle minimum entre deux affichages', () {
      expect(
        shouldShowSoftAsk(
          status: NotificationPermissionStatus.denied,
          shownCount: 1,
          lastShownAt: now.subtract(const Duration(days: 6)),
          now: now,
        ),
        isFalse,
      );
      expect(
        shouldShowSoftAsk(
          status: NotificationPermissionStatus.denied,
          shownCount: 1,
          lastShownAt: now.subtract(NotificationSoftAskService.minInterval),
          now: now,
        ),
        isTrue,
      );
    });

    test('plafonné à maxShows affichages', () {
      expect(
        shouldShowSoftAsk(
          status: NotificationPermissionStatus.denied,
          shownCount: NotificationSoftAskService.maxShows,
          lastShownAt: now.subtract(const Duration(days: 60)),
          now: now,
        ),
        isFalse,
      );
    });
  });

  group('NotificationSoftAskService', () {
    test('une seule proposition par session, compteur persisté', () async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final service = NotificationSoftAskService(preferences: preferences);

      expect(
        await service.shouldShow(NotificationPermissionStatus.notDetermined),
        isTrue,
      );
      await service.markShown();
      expect(
        await service.shouldShow(NotificationPermissionStatus.notDetermined),
        isFalse,
      );

      // Nouvelle session le même jour : l'intervalle bloque encore.
      final nextSession = NotificationSoftAskService(preferences: preferences);
      expect(
        await nextSession.shouldShow(
          NotificationPermissionStatus.notDetermined,
        ),
        isFalse,
      );
    });
  });
}
