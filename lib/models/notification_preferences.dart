import 'package:viro_team_v2/copy/app_copy.dart';

/// Préférences push utilisateur (events / annonces / cotisations / RSVP / chat).
class NotificationPreferences {
  const NotificationPreferences({
    this.events = true,
    this.announcements = true,
    this.fees = true,
    this.rsvp = true,
    this.chat = true,
  });

  final bool events;
  final bool announcements;
  final bool fees;
  final bool rsvp;
  final bool chat;

  static const NotificationPreferences defaults = NotificationPreferences();

  factory NotificationPreferences.fromMap(Map<String, dynamic>? map) {
    if (map == null) return defaults;
    return NotificationPreferences(
      events: map['events'] as bool? ?? true,
      announcements: map['announcements'] as bool? ?? true,
      fees: map['fees'] as bool? ?? true,
      rsvp: map['rsvp'] as bool? ?? true,
      chat: map['chat'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toMap() => {
        'events': events,
        'announcements': announcements,
        'fees': fees,
        'rsvp': rsvp,
        'chat': chat,
      };

  NotificationPreferences copyWith({
    bool? events,
    bool? announcements,
    bool? fees,
    bool? rsvp,
    bool? chat,
  }) {
    return NotificationPreferences(
      events: events ?? this.events,
      announcements: announcements ?? this.announcements,
      fees: fees ?? this.fees,
      rsvp: rsvp ?? this.rsvp,
      chat: chat ?? this.chat,
    );
  }
}

/// Message de confirmation quand on désactive une préférence.
String notificationPreferenceOffWarning(String key) {
  switch (key) {
    case 'events':
      return AppCopy.settings.notifOffWarningEvents;
    case 'announcements':
      return AppCopy.settings.notifOffWarningAnnouncements;
    case 'fees':
      return AppCopy.settings.notifOffWarningFees;
    case 'rsvp':
      return AppCopy.settings.notifOffWarningRsvp;
    case 'chat':
      return AppCopy.settings.notifOffWarningChat;
    default:
      return AppCopy.settings.notifOffWarningDefault;
  }
}
