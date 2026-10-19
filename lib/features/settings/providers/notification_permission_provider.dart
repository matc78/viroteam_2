import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/notification_permission_service.dart';

/// Permission système notifications, relue à chaque retour dans l'app
/// (l'utilisateur a pu la changer dans les réglages du téléphone).
class NotificationPermissionNotifier
    extends AsyncNotifier<NotificationPermissionStatus> {
  @override
  Future<NotificationPermissionStatus> build() async {
    final listener = AppLifecycleListener(onResume: refresh);
    ref.onDispose(listener.dispose);
    return ref.read(notificationPermissionServiceProvider).currentStatus();
  }

  /// Relit le statut sans rien demander.
  Future<void> refresh() async {
    final previous = state.value;
    final status = await ref
        .read(notificationPermissionServiceProvider)
        .currentStatus();
    state = AsyncData(status);
    if (previous != null &&
        previous != NotificationPermissionStatus.granted &&
        status == NotificationPermissionStatus.granted) {
      // Autorisé depuis les réglages du téléphone.
      await ref.read(pushNotificationServiceProvider).syncTokenAfterAuth();
    }
  }

  /// Popup système si possible, sinon réglages de l'app (voir
  /// [NotificationPermissionService.requestOrOpenSettings]).
  Future<NotificationPermissionStatus> requestOrOpenSettings() async {
    final status = await ref
        .read(notificationPermissionServiceProvider)
        .requestOrOpenSettings();
    state = AsyncData(status);
    if (status == NotificationPermissionStatus.granted) {
      // iOS : le token APNs/FCM peut n'être disponible qu'après l'accord.
      await ref.read(pushNotificationServiceProvider).syncTokenAfterAuth();
    }
    return status;
  }
}

final notificationPermissionProvider =
    AsyncNotifierProvider<
      NotificationPermissionNotifier,
      NotificationPermissionStatus
    >(NotificationPermissionNotifier.new);
