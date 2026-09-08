/// Préférences push utilisateur (3 toggles V1).
class NotificationPreferences {
  const NotificationPreferences({
    this.events = true,
    this.announcements = true,
    this.fees = true,
  });

  final bool events;
  final bool announcements;
  final bool fees;

  static const NotificationPreferences defaults = NotificationPreferences();

  factory NotificationPreferences.fromMap(Map<String, dynamic>? map) {
    if (map == null) return defaults;
    return NotificationPreferences(
      events: map['events'] as bool? ?? true,
      announcements: map['announcements'] as bool? ?? true,
      fees: map['fees'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toMap() => {
        'events': events,
        'announcements': announcements,
        'fees': fees,
      };

  NotificationPreferences copyWith({
    bool? events,
    bool? announcements,
    bool? fees,
  }) {
    return NotificationPreferences(
      events: events ?? this.events,
      announcements: announcements ?? this.announcements,
      fees: fees ?? this.fees,
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
    default:
      return 'Vous ne recevrez plus ce type de notification.';
  }
}
