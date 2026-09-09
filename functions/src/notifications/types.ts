/** Types partagés pour les push notifications V1. */

export type NotificationPreferenceKey =
  | "events"
  | "announcements"
  | "fees"
  | "rsvp";

export type FcmPlatform = "ios" | "android" | "web";

export type PushPayload = {
  title: string;
  body: string;
  /** Clé de préférence à respecter (absent = toujours envoyer). */
  preferenceKey: NotificationPreferenceKey;
  data: Record<string, string>;
};

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

export const MANUAL_PUSH_COOLDOWN_MS = 60 * 60 * 1000;

/** Délai avant push RSVP : le statut doit rester stable aussi longtemps. */
export const RSVP_NOTIFY_DEBOUNCE_MS = 60 * 1000;

export const ANNOUNCEMENT_BODY_MAX_CHARS = 120;

export const PARIS_TZ = "Europe/Paris";
