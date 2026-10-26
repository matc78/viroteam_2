import 'package:viro_team_v2/copy/app_copy.dart';

/// Moment du bilan des réponses envoyé aux coachs (valeur Firestore
/// `coachSummaryTiming`) : 2 jours avant, la veille au soir ou avec le
/// rappel du jour J.
enum CoachSummaryTiming {
  j2('j2'),
  eve('eve'),
  day('day');

  const CoachSummaryTiming(this.wireValue);

  /// Valeur stockée dans `notificationPreferences.coachSummaryTiming`.
  final String wireValue;

  /// Réglage lu depuis Firestore ; valeur absente ou inconnue → [eve].
  static CoachSummaryTiming fromWire(Object? value) {
    for (final timing in values) {
      if (timing.wireValue == value) return timing;
    }
    return eve;
  }
}

/// Préférences push utilisateur (events / récap / annonces / cotisations /
/// RSVP / chat / bilan coach). Les défauts doivent rester alignés avec
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
    this.coachSummaryTiming = CoachSummaryTiming.eve,
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

  /// Moment du bilan des réponses (coachs uniquement).
  final CoachSummaryTiming coachSummaryTiming;

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
      coachSummaryTiming: CoachSummaryTiming.fromWire(
        map['coachSummaryTiming'],
      ),
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
        'coachSummaryTiming': coachSummaryTiming.wireValue,
      };

  NotificationPreferences copyWith({
    bool? events,
    bool? weeklyDigest,
    bool? announcements,
    bool? fees,
    bool? rsvp,
    bool? rsvpTeammates,
    bool? chat,
    CoachSummaryTiming? coachSummaryTiming,
  }) {
    return NotificationPreferences(
      events: events ?? this.events,
      weeklyDigest: weeklyDigest ?? this.weeklyDigest,
      announcements: announcements ?? this.announcements,
      fees: fees ?? this.fees,
      rsvp: rsvp ?? this.rsvp,
      rsvpTeammates: rsvpTeammates ?? this.rsvpTeammates,
      chat: chat ?? this.chat,
      coachSummaryTiming: coachSummaryTiming ?? this.coachSummaryTiming,
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
