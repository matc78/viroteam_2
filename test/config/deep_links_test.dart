import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/deep_links.dart';
import 'package:viro_team_v2/config/routes.dart';

void main() {
  group('deepLinkRouteFromUri', () {
    test('join avec code', () {
      expect(
        deepLinkRouteFromUri(Uri.parse('viroteam://join?code=ABC123')),
        '${AppRoutes.join}?code=ABC123',
      );
    });

    test('planning club + date', () {
      expect(
        deepLinkRouteFromUri(
          Uri.parse('viroteam://planning?clubId=c1&date=2026-09-15'),
        ),
        '${AppRoutes.clubPlanningPath('c1')}?date=2026-09-15',
      );
    });

    test('home', () {
      expect(
        deepLinkRouteFromUri(Uri.parse('viroteam://home?clubId=c1')),
        AppRoutes.home,
      );
    });

    test('fees', () {
      expect(
        deepLinkRouteFromUri(Uri.parse('viroteam://fees?clubId=c1')),
        AppRoutes.clubMyFeePath('c1'),
      );
    });
  });
}
