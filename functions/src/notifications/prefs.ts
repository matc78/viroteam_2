import {
  COACH_SUMMARY_TIMINGS,
  DEFAULT_COACH_SUMMARY_TIMING,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type CoachSummaryTiming,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "./types";

/** Parse le map Firestore `notificationPreferences` (défaut = tout opt-in). */
export function parseNotificationPreferences(
  raw: unknown,
): NotificationPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  const map = raw as Record<string, unknown>;
  const legacyEventsPreference = readBool(
    map.events,
    DEFAULT_NOTIFICATION_PREFERENCES.events,
  );
  return {
    events: legacyEventsPreference,
    announcements: readBool(
      map.announcements,
      DEFAULT_NOTIFICATION_PREFERENCES.announcements,
    ),
    fees: readBool(map.fees, DEFAULT_NOTIFICATION_PREFERENCES.fees),
    // Compat legacy: si `rsvp` n'existe pas encore, reprendre la préférence `events`.
    rsvp: readBool(map.rsvp, legacyEventsPreference),
    chat: readBool(map.chat, DEFAULT_NOTIFICATION_PREFERENCES.chat),
    weeklyDigest: readBool(
      map.weeklyDigest,
      DEFAULT_NOTIFICATION_PREFERENCES.weeklyDigest,
    ),
    rsvpTeammates: readBool(
      map.rsvpTeammates,
      DEFAULT_NOTIFICATION_PREFERENCES.rsvpTeammates,
    ),
    coachSummaryTiming: readCoachSummaryTiming(map.coachSummaryTiming),
  };
}

/** `true` si l'utilisateur accepte ce type de notif. */
export function prefersNotification(
  prefs: NotificationPreferences,
  key: NotificationPreferenceKey,
): boolean {
  return prefs[key] !== false;
}

/**
 * Filtre les uids dont la préférence pour [key] est active (et [alsoRequire]
 * si fourni) ; avec [onlyIfDisabled], ne garde que ceux pour qui cette clé
 * est coupée. Les docs absents / prefs absentes = valeurs par défaut.
 */
export function filterUidsByPreference(params: {
  uidPrefs: Map<string, NotificationPreferences>;
  uids: string[];
  key: NotificationPreferenceKey;
  alsoRequire?: NotificationPreferenceKey;
  onlyIfDisabled?: NotificationPreferenceKey;
}): string[] {
  return params.uids.filter((uid) => {
    const prefs =
      params.uidPrefs.get(uid) ?? DEFAULT_NOTIFICATION_PREFERENCES;
    if (!prefersNotification(prefs, params.key)) return false;
    if (params.alsoRequire && !prefersNotification(prefs, params.alsoRequire)) {
      return false;
    }
    if (
      params.onlyIfDisabled &&
      prefersNotification(prefs, params.onlyIfDisabled)
    ) {
      return false;
    }
    return true;
  });
}

/** Rate-limit : `true` si un nouvel envoi manuel est autorisé. */
export function canSendManualPush(params: {
  lastManualPushAtMs: number | null;
  nowMs: number;
  cooldownMs: number;
}): boolean {
  if (params.lastManualPushAtMs == null) return true;
  return params.nowMs - params.lastManualPushAtMs >= params.cooldownMs;
}

function readBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function readCoachSummaryTiming(value: unknown): CoachSummaryTiming {
  return COACH_SUMMARY_TIMINGS.find((timing) => timing === value) ??
    DEFAULT_COACH_SUMMARY_TIMING;
}
