import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/services/notification_permission_service.dart';

void main() {
  group('mapAuthorizationStatus', () {
    test('autorisé et provisoire = granted', () {
      for (final isAndroid in [true, false]) {
        expect(
          mapAuthorizationStatus(
            AuthorizationStatus.authorized,
            isAndroid: isAndroid,
          ),
          NotificationPermissionStatus.granted,
        );
        expect(
          mapAuthorizationStatus(
            AuthorizationStatus.provisional,
            isAndroid: isAndroid,
          ),
          NotificationPermissionStatus.granted,
        );
      }
    });

    test('denied : rattrapable sur Android, définitif sur iOS', () {
      expect(
        mapAuthorizationStatus(AuthorizationStatus.denied, isAndroid: true),
        NotificationPermissionStatus.denied,
      );
      expect(
        mapAuthorizationStatus(AuthorizationStatus.denied, isAndroid: false),
        NotificationPermissionStatus.blocked,
      );
    });

    test('deniedPermanently = blocked, notDetermined conservé', () {
      expect(
        mapAuthorizationStatus(
          AuthorizationStatus.deniedPermanently,
          isAndroid: true,
        ),
        NotificationPermissionStatus.blocked,
      );
      expect(
        mapAuthorizationStatus(
          AuthorizationStatus.notDetermined,
          isAndroid: false,
        ),
        NotificationPermissionStatus.notDetermined,
      );
    });
  });
}
