import 'dart:io';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/deep_links.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';

/// Initialise FCM, enregistre le token, route les taps vers les deep links.
class PushNotificationService {
  PushNotificationService({FirebaseFunctions? functions})
      : _functions =
            functions ?? FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFunctions _functions;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  GoRouter? _router;
  String? _lastRegisteredToken;
  bool _listenersBound = false;
  bool _initialMessageHandled = false;

  /// Attache le router pour la navigation au tap.
  void bindRouter(GoRouter router) {
    _router = router;
  }

  /// Demande la permission, enregistre le token, écoute les messages.
  ///
  /// Idempotent : les listeners ne sont branchés qu'une fois.
  Future<void> start() async {
    if (kIsWeb) return;

    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    _bindListenersOnce();

    final token = await _messaging.getToken();
    if (token != null) {
      await registerToken(token);
    }
  }

  /// Ré-enregistre le token après login (sans rebrancher les listeners).
  Future<void> syncTokenAfterAuth() async {
    if (kIsWeb) return;
    final token = await _messaging.getToken();
    if (token != null) {
      // Force un nouvel enregistrement même si le token matériel est identique
      // (changement de compte sur le même appareil).
      _lastRegisteredToken = null;
      await registerToken(token);
    }
  }

  void _bindListenersOnce() {
    if (_listenersBound) return;
    _listenersBound = true;

    FirebaseMessaging.onMessage.listen((message) {
      debugPrint(
        'FCM foreground: ${message.notification?.title} — ${message.notification?.body}',
      );
    });

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
          .call(<String, dynamic>{
        'token': token,
        'platform': platform,
      });
      _lastRegisteredToken = token;
    } catch (error) {
      debugPrint('registerFcmToken failed: $error');
    }
  }

  /// Désenregistre le token (logout).
  Future<void> unregisterCurrentToken() async {
    try {
      final token = await _messaging.getToken();
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
        .call(<String, dynamic>{
      'clubId': clubId,
      'eventId': eventId,
    });
    final data = Map<String, dynamic>.from(result.data as Map? ?? {});
    return (
      recipientCount: (data['recipientCount'] as num?)?.toInt() ?? 0,
      tokenCount: (data['tokenCount'] as num?)?.toInt() ?? 0,
    );
  }

  void _handleMessageNavigation(RemoteMessage message) {
    final data = message.data;
    final deepLink = data['deepLink']?.toString();
    if (deepLink != null && deepLink.isNotEmpty) {
      final uri = Uri.tryParse(deepLink);
      if (uri != null) {
        final route = deepLinkRouteFromUri(uri);
        if (route != null) {
          _router?.go(route);
          return;
        }
      }
    }
  }
}
