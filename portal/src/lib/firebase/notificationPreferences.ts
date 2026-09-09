/** Préférences push (events / annonces / cotisations / RSVP). */
export type NotificationPreferences = {
  events: boolean;
  announcements: boolean;
  fees: boolean;
  rsvp: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  events: true,
  announcements: true,
  fees: true,
  rsvp: true,
};

/** Parse le map Firestore (défaut = opt-in). */
export function parseNotificationPreferences(
  raw: unknown,
): NotificationPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  const map = raw as Record<string, unknown>;
  return {
    events:
      typeof map.events === "boolean"
        ? map.events
        : DEFAULT_NOTIFICATION_PREFERENCES.events,
    announcements:
      typeof map.announcements === "boolean"
        ? map.announcements
        : DEFAULT_NOTIFICATION_PREFERENCES.announcements,
    fees:
      typeof map.fees === "boolean"
        ? map.fees
        : DEFAULT_NOTIFICATION_PREFERENCES.fees,
    rsvp:
      typeof map.rsvp === "boolean"
        ? map.rsvp
        : DEFAULT_NOTIFICATION_PREFERENCES.rsvp,
  };
}

/** Message de confirmation à la désactivation. */
export function preferenceOffWarning(
  key: keyof NotificationPreferences,
): string {
  switch (key) {
    case "events":
      return "Vous ne recevrez plus les rappels d’événements (J-7, J-2) ni les notifications envoyées par les coaches.";
    case "announcements":
      return "Vous ne recevrez plus de notification à la publication des annonces du club.";
    case "fees":
      return "Vous ne recevrez plus les rappels hebdomadaires de cotisation.";
    case "rsvp":
      return "Vous ne recevrez plus de notification à chaque changement de RSVP.";
  }
}
