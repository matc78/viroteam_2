import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

/// Autorisation système d'afficher des notifications.
enum NotificationPermissionStatus {
  /// Autorisé (y compris « provisoire » iOS).
  granted,

  /// Jamais demandé : la popup système peut s'afficher.
  notDetermined,

  /// Refusé, mais Android peut encore reproposer la popup.
  denied,

  /// Refusé définitivement (iOS dès le premier refus, Android après le
  /// second) : seuls les réglages du téléphone permettent d'autoriser.
  blocked,
}

/// Lecture / demande de la permission notifications et accès aux réglages.
class NotificationPermissionService {
  NotificationPermissionService({FirebaseMessaging? messaging})
    : _messaging = messaging;

  FirebaseMessaging? _messaging;

  static const _systemSettingsChannel = MethodChannel(
    'com.viroteam/system_settings',
  );

  FirebaseMessaging get _fcm => _messaging ??= FirebaseMessaging.instance;

  /// Statut courant, sans rien demander à l'utilisateur.
  Future<NotificationPermissionStatus> currentStatus() async {
    if (kIsWeb) return NotificationPermissionStatus.blocked;
    final settings = await _fcm.getNotificationSettings();
    return mapAuthorizationStatus(
      settings.authorizationStatus,
      isAndroid: Platform.isAndroid,
    );
  }

  /// Bouton « Activer » : popup système si l'OS peut encore l'afficher,
  /// sinon ouverture des réglages de l'app. Retourne le statut après la
  /// popup (inchangé si on a ouvert les réglages : relu au retour dans l'app).
  Future<NotificationPermissionStatus> requestOrOpenSettings() async {
    final status = await currentStatus();
    if (status == NotificationPermissionStatus.granted) return status;
    if (status == NotificationPermissionStatus.blocked) {
      await openSystemSettings();
      return status;
    }
    final settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return mapAuthorizationStatus(
      settings.authorizationStatus,
      isAndroid: Platform.isAndroid,
    );
  }

  /// Ouvre les réglages de notifications de l'app (Android) ou la fiche de
  /// l'app dans Réglages (iOS).
  Future<void> openSystemSettings() async {
    if (Platform.isAndroid) {
      await _systemSettingsChannel.invokeMethod<void>(
        'openNotificationSettings',
      );
      return;
    }
    await launchUrl(Uri.parse('app-settings:'));
  }
}

/// Traduit le statut firebase_messaging en statut applicatif.
///
/// `denied` n'a pas le même sens selon l'OS : définitif sur iOS, encore
/// rattrapable sur Android (le définitif y est `deniedPermanently`).
@visibleForTesting
NotificationPermissionStatus mapAuthorizationStatus(
  AuthorizationStatus status, {
  required bool isAndroid,
}) => switch (status) {
  AuthorizationStatus.authorized ||
  AuthorizationStatus.provisional => NotificationPermissionStatus.granted,
  AuthorizationStatus.notDetermined =>
    NotificationPermissionStatus.notDetermined,
  AuthorizationStatus.denied =>
    isAndroid
        ? NotificationPermissionStatus.denied
        : NotificationPermissionStatus.blocked,
  AuthorizationStatus.deniedPermanently => NotificationPermissionStatus.blocked,
};
