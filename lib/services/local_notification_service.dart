import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/config/push_channels.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Affichage local des push reçues app ouverte (Android et iOS) et création
/// des canaux Android.
///
/// Quand l'app est en arrière-plan, c'est le système (FCM) qui affiche la
/// notif ; au premier plan, c'est ce service, avec le même canal et le même
/// tag : une notif locale remplace donc proprement une notif FCM de même tag.
class LocalNotificationService {
  LocalNotificationService({FlutterLocalNotificationsPlugin? plugin})
    : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  bool _initialized = false;
  int _untaggedId = 0;

  /// Initialise le plugin, crée les canaux Android et branche le tap.
  ///
  /// [onTap] reçoit le deep link (payload) d'une notif locale tapée, y compris
  /// quand ce tap a lancé l'app. Les permissions ne sont **pas** demandées ici.
  Future<void> initialize({
    required void Function(String deepLink) onTap,
  }) async {
    if (kIsWeb || _initialized) return;
    _initialized = true;

    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@drawable/ic_notification'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (response) {
        final deepLink = response.payload;
        if (deepLink != null && deepLink.isNotEmpty) onTap(deepLink);
      },
    );

    await _createAndroidChannels();

    final launch = await _plugin.getNotificationAppLaunchDetails();
    final launchDeepLink = launch?.notificationResponse?.payload;
    if ((launch?.didNotificationLaunchApp ?? false) &&
        launchDeepLink != null &&
        launchDeepLink.isNotEmpty) {
      // Même chemin que le tap FCM à froid : après la première frame.
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => onTap(launchDeepLink),
      );
    }
  }

  Future<void> _createAndroidChannels() async {
    if (!Platform.isAndroid) return;
    final android = _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    if (android == null) return;
    for (final channel in PushChannel.values) {
      if (channel == PushChannel.chat && !FeatureFlags.chatMessagingLive) {
        continue;
      }
      await android.createNotificationChannel(
        AndroidNotificationChannel(
          channel.id,
          channelName(channel),
          description: channelDescription(channel),
          importance: channel.highImportance
              ? Importance.high
              : Importance.defaultImportance,
        ),
      );
    }
  }

  /// Affiche une push reçue au premier plan.
  ///
  /// [tag] (`data.tag` serveur) : même tag = remplace la notif précédente.
  /// [deepLink] est rendu à `onTap` au tap.
  Future<void> showPush({
    required String title,
    required String body,
    required String? preferenceKey,
    required String? tag,
    required String? deepLink,
  }) async {
    if (!_initialized) return;
    final channel = PushChannel.forPreferenceKey(preferenceKey);
    final hasTag = tag != null && tag.isNotEmpty;

    await _plugin.show(
      // Android : FCM affiche une notif taguée avec l'id 0 ; même couple
      // (tag, id) = remplacement. iOS : id stable dérivé du tag.
      id: hasTag
          ? (Platform.isAndroid ? 0 : stableNotificationId(tag))
          : _nextUntaggedId(),
      title: title,
      body: body,
      payload: deepLink,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          channel.id,
          channelName(channel),
          channelDescription: channelDescription(channel),
          importance: channel.highImportance
              ? Importance.high
              : Importance.defaultImportance,
          priority: channel.highImportance
              ? Priority.high
              : Priority.defaultPriority,
          icon: '@drawable/ic_notification',
          color: ViroColors.primary600,
          tag: hasTag ? tag : null,
          styleInformation: BigTextStyleInformation(body),
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBanner: true,
          presentList: true,
          presentSound: channel.highImportance,
          threadIdentifier: hasTag ? tag : channel.id,
        ),
      ),
    );
  }

  /// Ids des notifs sans tag : uniques sur la session, jamais 0 (réservé au
  /// remplacement des notifs taguées sur Android).
  int _nextUntaggedId() {
    _untaggedId = (_untaggedId % 0x3FFFFFFF) + 1;
    return 0x40000000 + _untaggedId;
  }

  /// Nom du canal affiché dans les réglages Android.
  static String channelName(PushChannel channel) => switch (channel) {
    PushChannel.events => AppCopy.notifications.channelEventsName,
    PushChannel.announcements => AppCopy.notifications.channelAnnouncementsName,
    PushChannel.chat => AppCopy.notifications.channelChatName,
    PushChannel.fees => AppCopy.notifications.channelFeesName,
    PushChannel.rsvp => AppCopy.notifications.channelRsvpName,
  };

  /// Description du canal affichée dans les réglages Android.
  static String channelDescription(PushChannel channel) => switch (channel) {
    PushChannel.events => AppCopy.notifications.channelEventsDescription,
    PushChannel.announcements =>
      AppCopy.notifications.channelAnnouncementsDescription,
    PushChannel.chat => AppCopy.notifications.channelChatDescription,
    PushChannel.fees => AppCopy.notifications.channelFeesDescription,
    PushChannel.rsvp => AppCopy.notifications.channelRsvpDescription,
  };
}

/// Id de notif stable pour un tag (FNV-1a 32 bits, borné à 2^30) :
/// `String.hashCode` n'est pas garanti stable d'un lancement à l'autre.
@visibleForTesting
int stableNotificationId(String tag) {
  var hash = 0x811C9DC5;
  for (final unit in tag.codeUnits) {
    hash ^= unit;
    hash = (hash * 0x01000193) & 0xFFFFFFFF;
  }
  // [1, 2^30) : disjoint des ids sans tag (≥ 2^30).
  return (hash % 0x3FFFFFFF) + 1;
}
