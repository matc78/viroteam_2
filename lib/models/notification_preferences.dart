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
      return 'Vous ne recevrez plus les rappels d’événements (J-7, J-2) ni les notifications envoyées par les coaches.';
    case 'announcements':
      return 'Vous ne recevrez plus de notification à la publication des annonces du club.';
    case 'fees':
      return 'Vous ne recevrez plus les rappels hebdomadaires de cotisation.';
    case 'rsvp':
      return 'Vous ne recevrez plus de notification à chaque changement de RSVP.';
    default:
      return 'Vous ne recevrez plus ce type de notification.';
  }
}
