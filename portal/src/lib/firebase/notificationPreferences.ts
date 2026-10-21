/**
 * Préférences push (convocations / récap / annonces / cotisations / RSVP /
 * chat). Défauts alignés avec `functions/src/notifications/types.ts` et l'app.
 * Le map est réécrit en entier : toute clé doit être lue ici, sinon on
 * effacerait un choix fait dans l'app.
 */
export type NotificationPreferences = {
  events: boolean;
  weeklyDigest: boolean;
  announcements: boolean;
  fees: boolean;
  rsvp: boolean;
  rsvpTeammates: boolean;
  chat: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  events: true,
  weeklyDigest: true,
  announcements: true,
  fees: true,
  rsvp: true,
  // Réponses des coéquipiers : opt-in.
  rsvpTeammates: false,
  chat: true,
};

/** Parse le map Firestore (clé absente = valeur par défaut). */
export function parseNotificationPreferences(
  raw: unknown,
): NotificationPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  const map = raw as Record<string, unknown>;
  const parsed = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  for (const key of Object.keys(parsed) as Array<keyof NotificationPreferences>) {
    if (typeof map[key] === "boolean") parsed[key] = map[key];
  }
  return parsed;
}

/** Message de confirmation à la désactivation. */
export function preferenceOffWarning(
  key: keyof NotificationPreferences,
): string {
  switch (key) {
    case "events":
      return "Tu ne recevras plus les convocations, les rappels (2 jours avant, jour J) ni les notifs envoyées par les coachs.";
    case "weeklyDigest":
      return "Tu ne recevras plus le récap du dimanche soir. Les rappels 2 jours avant prendront le relais.";
    case "announcements":
      return "Tu ne recevras plus de notification à la publication des annonces du club.";
    case "fees":
      return "Tu ne recevras plus les rappels hebdomadaires de cotisation.";
    case "rsvp":
      return "Tu ne recevras plus de notif quand quelqu’un répond à une convocation.";
    case "rsvpTeammates":
      return "Tu ne recevras plus les réponses de tes coéquipiers.";
    case "chat":
      return "Tu ne recevras plus de notification pour les nouveaux messages.";
  }
}
