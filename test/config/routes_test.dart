import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/routes.dart';

void main() {
  group('AppRoutes club admin paths', () {
    test('equipment et settings utilisent les chemins anglais', () {
      expect(
        AppRoutes.clubEquipmentPath('club123'),
        '/club/club123/equipment',
      );
      expect(
        AppRoutes.clubSettingsPath('club123'),
        '/club/club123/settings',
      );
      expect(AppRoutes.clubEquipment, '/club/:clubId/equipment');
      expect(AppRoutes.clubSettings, '/club/:clubId/settings');
    });
  });
}
