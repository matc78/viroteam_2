import 'package:viro_team_v2/copy/app_copy.dart';

/// Préférences push utilisateur (events / annonces / cotisations / RSVP).
class NotificationPreferences {
  const NotificationPreferences({
    this.events = true,
    this.announcements = true,
    this.fees = true,
    this.rsvp = true,
  });

  final bool events;
  final bool announcements;
  final bool fees;
  final bool rsvp;

  static const NotificationPreferences defaults = NotificationPreferences();

  factory NotificationPreferences.fromMap(Map<String, dynamic>? map) {
    if (map == null) return defaults;
    return NotificationPreferences(
      events: map['events'] as bool? ?? true,
      announcements: map['announcements'] as bool? ?? true,
      fees: map['fees'] as bool? ?? true,
      rsvp: map['rsvp'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toMap() => {
        'events': events,
        'announcements': announcements,
        'fees': fees,
        'rsvp': rsvp,
      };

  NotificationPreferences copyWith({
    bool? events,
    bool? announcements,
    bool? fees,
    bool? rsvp,
  }) {
    return NotificationPreferences(
      events: events ?? this.events,
      announcements: announcements ?? this.announcements,
      fees: fees ?? this.fees,
      rsvp: rsvp ?? this.rsvp,
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
    default:
      return AppCopy.settings.notifOffWarningDefault;
  }
}
