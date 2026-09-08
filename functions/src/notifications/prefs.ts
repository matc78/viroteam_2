import {
  DEFAULT_NOTIFICATION_PREFERENCES,
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
  return {
    events: readBool(map.events, DEFAULT_NOTIFICATION_PREFERENCES.events),
    announcements: readBool(
      map.announcements,
      DEFAULT_NOTIFICATION_PREFERENCES.announcements,
    ),
    fees: readBool(map.fees, DEFAULT_NOTIFICATION_PREFERENCES.fees),
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
 * Filtre les uids dont la préférence pour [key] est active.
 * Les docs absents / prefs absentes = opt-in.
 */
export function filterUidsByPreference(params: {
  uidPrefs: Map<string, NotificationPreferences>;
  uids: string[];
  key: NotificationPreferenceKey;
}): string[] {
  return params.uids.filter((uid) => {
    const prefs =
      params.uidPrefs.get(uid) ?? DEFAULT_NOTIFICATION_PREFERENCES;
    return prefersNotification(prefs, params.key);
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
