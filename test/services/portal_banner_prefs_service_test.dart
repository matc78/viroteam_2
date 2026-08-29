import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/services/portal_banner_prefs_service.dart';

void main() {
  group('PortalBannerPrefsService', () {
    late PortalBannerPrefsService service;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      service = PortalBannerPrefsService(preferences: preferences);
    });

    test('isDismissed retourne false par défaut', () async {
      final dismissed = await service.isDismissed(
        userId: 'user1',
        bannerId: PortalBannerIds.planning,
      );
      expect(dismissed, isFalse);
    });

    test('dismiss mémorise le masquage par utilisateur et écran', () async {
      await service.dismiss(
        userId: 'user1',
        bannerId: PortalBannerIds.planning,
      );

      expect(
        await service.isDismissed(
          userId: 'user1',
          bannerId: PortalBannerIds.planning,
        ),
        isTrue,
      );
      expect(
        await service.isDismissed(
          userId: 'user1',
          bannerId: PortalBannerIds.members,
        ),
        isFalse,
      );
      expect(
        await service.isDismissed(
          userId: 'user2',
          bannerId: PortalBannerIds.planning,
        ),
        isFalse,
      );
    });
  });
}
