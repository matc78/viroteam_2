import 'dart:io';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:viro_team_v2/services/foreground_push_policy.dart';
import 'package:viro_team_v2/services/local_notification_service.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';

/// Initialise FCM, enregistre le token, affiche les push au premier plan et
/// route les taps vers les deep links.
///
/// La permission système n'est pas demandée ici : voir
/// `NotificationPermissionService` (pré-demande au bon moment).
class PushNotificationService {
  PushNotificationService({
    FirebaseFunctions? functions,
    LocalNotificationService? localNotifications,
  }) : _functions =
           functions ?? FirebaseFunctions.instanceFor(region: 'europe-west1'),
       _localNotifications = localNotifications ?? LocalNotificationService();

  final FirebaseFunctions _functions;
  final LocalNotificationService _localNotifications;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  void Function(Uri uri)? _onDeepLink;
  String? Function()? _currentPath;
  String? _lastRegisteredToken;
  bool _listenersBound = false;
  bool _initialMessageHandled = false;

  /// Attache le gestionnaire de deep link appelé au tap sur une notif.
  ///
  /// Le gestionnaire décide seul de la session club et du différé si la
  /// session n’est pas prête (cf. `handleDeepLinkUri`).
  void bindDeepLinkHandler(void Function(Uri uri) handler) {
    _onDeepLink = handler;
  }

  /// Attache la lecture du chemin go_router courant, utilisée pour ne pas
  /// afficher une bannière redondante avec l'écran ouvert.
  void bindCurrentPathResolver(String? Function() resolver) {
    _currentPath = resolver;
  }

  /// Prépare l'affichage, écoute les messages, enregistre le token.
  ///
  /// Idempotent : les listeners ne sont branchés qu'une fois.
  Future<void> start() async {
    if (kIsWeb) return;

    // Premier plan : c'est l'app qui affiche la bannière (Android comme iOS)
    // via LocalNotificationService, pour pouvoir filtrer. On coupe donc
    // l'alerte système iOS au premier plan (le badge reste géré par l'OS).
    if (Platform.isIOS || Platform.isMacOS) {
      try {
        await _messaging.setForegroundNotificationPresentationOptions(
          alert: false,
          badge: true,
          sound: false,
        );
      } catch (error, stack) {
        _recordSoftFcmFailure(
          error: error,
          stack: stack,
          reason: 'fcm_foreground_presentation_failed',
        );
      }
    }

    try {
      await _localNotifications.initialize(onTap: _handleDeepLinkString);
    } catch (error, stack) {
      _recordSoftFcmFailure(
        error: error,
        stack: stack,
        reason: 'local_notifications_init_failed',
      );
    }

    _bindListenersOnce();

    final token = await _fetchTokenSafely();
    if (token != null) {
      await registerToken(token);
    }
  }

  /// Ré-enregistre le token après login (sans rebrancher les listeners).
  Future<void> syncTokenAfterAuth() async {
    if (kIsWeb) return;
    final token = await _fetchTokenSafely();
    if (token != null) {
      // Force un nouvel enregistrement même si le token matériel est identique
      // (changement de compte sur le même appareil).
      _lastRegisteredToken = null;
      await registerToken(token);
    }
  }

  /// Récupère le token FCM sans faire planter l'app (Play Services HS, etc.).
  Future<String?> _fetchTokenSafely() async {
    try {
      return await _messaging.getToken();
    } catch (error, stack) {
      _recordSoftFcmFailure(
        error: error,
        stack: stack,
        reason: 'fcm_get_token_failed',
      );
      return null;
    }
  }

  /// Enregistre une erreur soft Crashlytics (best-effort).
  void _recordSoftFcmFailure({
    required Object error,
    StackTrace? stack,
    required String reason,
  }) {
    debugPrint('FCM soft failure ($reason): $error');
    try {
      FirebaseCrashlytics.instance.recordError(
        error,
        stack,
        fatal: false,
        reason: reason,
      );
    } catch (_) {
      // Le monitoring ne doit jamais bloquer le démarrage.
    }
  }

  void _bindListenersOnce() {
    if (_listenersBound) return;
    _listenersBound = true;

    FirebaseMessaging.onMessage.listen(_presentForegroundMessage);

    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageNavigation);

    _messaging.onTokenRefresh.listen((token) {
      registerToken(token);
    });

    if (!_initialMessageHandled) {
      _initialMessageHandled = true;
      _messaging.getInitialMessage().then((initial) {
        if (initial == null) return;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _handleMessageNavigation(initial);
        });
      });
    }
  }

  /// Push reçue app ouverte : bannière locale, sauf si redondante.
  Future<void> _presentForegroundMessage(RemoteMessage message) async {
    final title = message.notification?.title ?? message.data['title'];
    final body = message.notification?.body ?? message.data['body'];
    final shouldPresent = ForegroundPushPolicy.shouldPresent(
      data: message.data,
      title: title?.toString(),
      body: body?.toString(),
      currentPath: _currentPath?.call(),
    );
    if (!shouldPresent) return;
    try {
      await _localNotifications.showPush(
        title: title?.toString() ?? '',
        body: body?.toString() ?? '',
        preferenceKey: message.data['preferenceKey']?.toString(),
        tag: message.data['tag']?.toString(),
        deepLink: message.data['deepLink']?.toString(),
      );
    } catch (error, stack) {
      _recordSoftFcmFailure(
        error: error,
        stack: stack,
        reason: 'foreground_push_display_failed',
      );
    }
  }

  /// Envoie le token courant aux Cloud Functions.
  Future<void> registerToken(String token) async {
    if (token.isEmpty || token == _lastRegisteredToken) return;
    final platform = Platform.isIOS
        ? 'ios'
        : Platform.isAndroid
        ? 'android'
        : 'web';
    try {
      await _functions
          .httpsCallable(cloudCallableName('registerFcmToken'))
          .call(<String, dynamic>{'token': token, 'platform': platform});
      _lastRegisteredToken = token;
    } catch (error) {
      debugPrint('registerFcmToken failed: $error');
    }
  }

  /// Désenregistre le token (logout).
  Future<void> unregisterCurrentToken() async {
    try {
      final token = await _fetchTokenSafely();
      if (token == null || token.isEmpty) return;
      await _functions
          .httpsCallable(cloudCallableName('unregisterFcmToken'))
          .call(<String, dynamic>{'token': token});
      _lastRegisteredToken = null;
    } catch (error) {
      debugPrint('unregisterFcmToken failed: $error');
    }
  }

  /// Envoi manuel d'une notif event (coach / admin).
  Future<({int recipientCount, int tokenCount})> sendEventPush({
    required String clubId,
    required String eventId,
  }) async {
    final result = await _functions
        .httpsCallable(cloudCallableName('sendEventPush'))
        .call(<String, dynamic>{'clubId': clubId, 'eventId': eventId});
    final data = Map<String, dynamic>.from(result.data as Map? ?? {});
    return (
      recipientCount: (data['recipientCount'] as num?)?.toInt() ?? 0,
      tokenCount: (data['tokenCount'] as num?)?.toInt() ?? 0,
    );
  }

  /// Tap sur une notif FCM : délègue au gestionnaire de deep link (session
  /// club + différé à froid inclus).
  void _handleMessageNavigation(RemoteMessage message) {
    _handleDeepLinkString(message.data['deepLink']?.toString());
  }

  /// Tap sur une notif (FCM ou locale) portant un deep link.
  void _handleDeepLinkString(String? deepLink) {
    if (deepLink == null || deepLink.isEmpty) return;
    final uri = Uri.tryParse(deepLink);
    if (uri == null) return;
    _onDeepLink?.call(uri);
  }
}
