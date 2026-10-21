import 'package:viro_team_v2/copy/app_copy.dart';

/// Préférences push utilisateur (events / récap / annonces / cotisations /
/// RSVP / chat). Les défauts doivent rester alignés avec
/// `functions/src/notifications/types.ts`.
class NotificationPreferences {
  const NotificationPreferences({
    this.events = true,
    this.weeklyDigest = true,
    this.announcements = true,
    this.fees = true,
    this.rsvp = true,
    this.rsvpTeammates = false,
    this.chat = true,
  });

  final bool events;

  /// Récap de la semaine le dimanche soir.
  final bool weeklyDigest;
  final bool announcements;
  final bool fees;
  final bool rsvp;

  /// Réponses des coéquipiers (opt-in) ; le staff les reçoit via [rsvp].
  final bool rsvpTeammates;
  final bool chat;

  static const NotificationPreferences defaults = NotificationPreferences();

  factory NotificationPreferences.fromMap(Map<String, dynamic>? map) {
    if (map == null) return defaults;
    return NotificationPreferences(
      events: map['events'] as bool? ?? true,
      weeklyDigest: map['weeklyDigest'] as bool? ?? true,
      announcements: map['announcements'] as bool? ?? true,
      fees: map['fees'] as bool? ?? true,
      rsvp: map['rsvp'] as bool? ?? true,
      rsvpTeammates: map['rsvpTeammates'] as bool? ?? false,
      chat: map['chat'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toMap() => {
        'events': events,
        'weeklyDigest': weeklyDigest,
        'announcements': announcements,
        'fees': fees,
        'rsvp': rsvp,
        'rsvpTeammates': rsvpTeammates,
        'chat': chat,
      };

  NotificationPreferences copyWith({
    bool? events,
    bool? weeklyDigest,
    bool? announcements,
    bool? fees,
    bool? rsvp,
    bool? rsvpTeammates,
    bool? chat,
  }) {
    return NotificationPreferences(
      events: events ?? this.events,
      weeklyDigest: weeklyDigest ?? this.weeklyDigest,
      announcements: announcements ?? this.announcements,
      fees: fees ?? this.fees,
      rsvp: rsvp ?? this.rsvp,
      rsvpTeammates: rsvpTeammates ?? this.rsvpTeammates,
      chat: chat ?? this.chat,
    );
  }
}

/// Message de confirmation quand on désactive une préférence.
String notificationPreferenceOffWarning(String key) {
  switch (key) {
    case 'events':
      return AppCopy.settings.notifOffWarningEvents;
    case 'weeklyDigest':
      return AppCopy.settings.notifOffWarningWeeklyDigest;
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
