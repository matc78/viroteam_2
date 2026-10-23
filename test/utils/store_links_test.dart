import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/utils/store_links.dart';

void main() {
  group('store links', () {
    test('Google Play porte un referrer UTM encodé', () {
      final uri = Uri.parse(playStoreLink(StoreCampaign.inviteShare));
      expect(uri.queryParameters['id'], 'com.viroteam.viro_team');
      expect(
        uri.queryParameters['referrer'],
        'utm_source=app&utm_campaign=invite_share',
      );
    });

    test('App Store porte la campagne ct', () {
      final link = appStoreLink(StoreCampaign.inviteShare);
      final uri = Uri.parse(link);
      expect(link, startsWith(ProjectConfig.appStoreUrl));
      expect(uri.queryParameters['ct'], 'app_invite_share');
      expect(uri.queryParameters['mt'], '8');
    });
  });
}
