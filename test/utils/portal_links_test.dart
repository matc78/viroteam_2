import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/utils/portal_links.dart';

void main() {
  group('portalMembersUrl', () {
    test('inclut clubId sans tab', () {
      final uri = portalMembersUrl(clubId: 'club123');
      expect(uri.path, endsWith('/members'));
      expect(uri.queryParameters['clubId'], 'club123');
      expect(uri.queryParameters.containsKey('tab'), isFalse);
    });

    test('inclut tab optionnel', () {
      final uri = portalMembersUrl(clubId: 'club123', tab: 'parents');
      expect(uri.queryParameters['clubId'], 'club123');
      expect(uri.queryParameters['tab'], 'parents');
    });
  });

  group('portal module urls', () {
    test('equipment, settings et announcements incluent clubId', () {
      expect(portalEquipmentUrl(clubId: 'c1').path, endsWith('/equipment'));
      expect(portalSettingsUrl(clubId: 'c1').path, endsWith('/settings'));
      expect(
        portalAnnouncementsUrl(clubId: 'c1').path,
        endsWith('/announcements'),
      );
      expect(portalEquipmentUrl(clubId: 'c1').queryParameters['clubId'], 'c1');
      expect(portalSettingsUrl(clubId: 'c1').queryParameters['clubId'], 'c1');
      expect(
        portalAnnouncementsUrl(clubId: 'c1').queryParameters['clubId'],
        'c1',
      );
    });
  });
}
