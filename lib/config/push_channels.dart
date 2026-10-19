/// Canaux de notification Android, un par catégorie de préférence push.
///
/// Les ids doivent rester alignés avec `ANDROID_CHANNEL_IDS`
/// (`functions/src/notifications/fcmMessage.ts`) : la push serveur désigne le
/// canal, l'app le crée au démarrage. Un id inconnu de l'appareil retombe sur
/// le canal par défaut déclaré dans l'AndroidManifest ([fallback]).
enum PushChannel {
  events(id: 'viro_events', preferenceKey: 'events', highImportance: true),
  announcements(
    id: 'viro_announcements',
    preferenceKey: 'announcements',
    highImportance: true,
  ),
  chat(id: 'viro_chat', preferenceKey: 'chat', highImportance: true),
  fees(id: 'viro_fees', preferenceKey: 'fees', highImportance: false),
  rsvp(id: 'viro_rsvp', preferenceKey: 'rsvp', highImportance: false);

  const PushChannel({
    required this.id,
    required this.preferenceKey,
    required this.highImportance,
  });

  /// Id du canal Android.
  final String id;

  /// Clé `notificationPreferences` / `data.preferenceKey` de la push.
  final String preferenceKey;

  /// `true` : bannière + son (heads-up) ; `false` : notif discrète.
  final bool highImportance;

  /// Canal par défaut du manifest (`default_notification_channel_id`).
  static const fallback = PushChannel.events;

  /// Canal d'une push d'après sa `preferenceKey` (repli : [fallback]).
  static PushChannel forPreferenceKey(String? preferenceKey) {
    for (final channel in values) {
      if (channel.preferenceKey == preferenceKey) return channel;
    }
    return fallback;
  }
}
