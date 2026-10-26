/** Types partagés pour les push notifications V1. */

export type NotificationPreferenceKey =
  | "events"
  | "announcements"
  | "fees"
  | "rsvp"
  | "chat"
  | "weeklyDigest"
  | "rsvpTeammates";

export type FcmPlatform = "ios" | "android" | "web";

export type PushPayload = {
  title: string;
  body: string;
  /** Clé de préférence à respecter (absent = toujours envoyer). */
  preferenceKey: NotificationPreferenceKey;
  /** Clé supplémentaire qui doit aussi être active (ex. RSVP des coéquipiers). */
  alsoRequire?: NotificationPreferenceKey;
  /** N'envoyer qu'aux uids pour qui cette clé est **désactivée**. */
  onlyIfDisabled?: NotificationPreferenceKey;
  data: Record<string, string>;
};

/**
 * Moment du bilan des réponses envoyé aux coachs : 2 jours avant, la veille
 * au soir ou avec le rappel du jour J.
 */
export type CoachSummaryTiming = "j2" | "eve" | "day";

export const COACH_SUMMARY_TIMINGS: readonly CoachSummaryTiming[] = [
  "j2",
  "eve",
  "day",
];

export const DEFAULT_COACH_SUMMARY_TIMING: CoachSummaryTiming = "eve";

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean> & {
  coachSummaryTiming: CoachSummaryTiming;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  events: true,
  announcements: true,
  fees: true,
  rsvp: true,
  chat: true,
  weeklyDigest: true,
  // Les réponses des coéquipiers ne partent qu'aux joueurs qui l'ont demandé.
  rsvpTeammates: false,
  coachSummaryTiming: DEFAULT_COACH_SUMMARY_TIMING,
};

export const MANUAL_PUSH_COOLDOWN_MS = 60 * 60 * 1000;

/** Délai avant push RSVP : le statut doit rester stable aussi longtemps. */
export const RSVP_NOTIFY_DEBOUNCE_MS = 5 * 1000;

/** Délai de regroupement des modifications d'un event avant push. */
export const EVENT_MODIFIED_DEBOUNCE_MS = 10 * 60 * 1000;

/** Regroupement raccourci le jour J : un changement de dernière minute doit arriver à temps. */
export const EVENT_MODIFIED_SAME_DAY_DEBOUNCE_MS = 2 * 60 * 1000;

/**
 * Heure (HH:mm) avant laquelle le rappel du jour J part la veille au soir :
 * à 8h00 il serait trop tard pour un event matinal.
 */
export const DAY_OF_REMINDER_EVE_BEFORE = "10:00";

export const ANNOUNCEMENT_BODY_MAX_CHARS = 120;

export const PARIS_TZ = "Europe/Paris";
