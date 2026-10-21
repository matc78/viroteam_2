import type { MulticastMessage } from "firebase-admin/messaging";
import type { NotificationPreferenceKey, PushPayload } from "./types";

/**
 * Canaux Android, un par catégorie de préférence. Les ids doivent rester
 * alignés avec `PushChannels` côté Flutter (`lib/config/push_channels.dart`) :
 * un canal inconnu de l'appareil retombe sur le canal par défaut du manifest.
 */
export const ANDROID_CHANNEL_IDS: Record<NotificationPreferenceKey, string> = {
  events: "viro_events",
  announcements: "viro_announcements",
  chat: "viro_chat",
  fees: "viro_fees",
  rsvp: "viro_rsvp",
};

/** Canal Android d'une catégorie de push. */
export function androidChannelId(key: NotificationPreferenceKey): string {
  return ANDROID_CHANNEL_IDS[key];
}

/**
 * Regroupement d'une push.
 * - `tag` : une nouvelle push au même tag **remplace** la précédente
 *   (Android `tag`, iOS `apns-collapse-id`). Ex. un event modifié deux fois.
 * - `threadId` : regroupe sans remplacer (iOS `thread-id`), pour le chat.
 */
export function pushGrouping(data: Record<string, string>): {
  tag?: string;
  threadId?: string;
} {
  const type = data.type ?? "";
  if (type === "chat_message" && data.conversationId) {
    return { threadId: `chat_${data.conversationId}` };
  }
  if (type === "event_rsvp_changed" && data.eventId) {
    // Un tag par event : la dernière push RSVP remplace la précédente (anti-spam).
    const tag = `rsvp_${data.eventId}`;
    return { tag, threadId: `event_${data.eventId}` };
  }
  if (type.startsWith("event_") && data.eventId) {
    const tag = `event_${data.eventId}`;
    return { tag, threadId: tag };
  }
  if (type === "announcement_published" && data.announcementId) {
    const tag = `announcement_${data.announcementId}`;
    return { tag, threadId: "announcements" };
  }
  if (type.startsWith("fee_") && data.seasonId) {
    const tag = `fees_${data.seasonId}`;
    return { tag, threadId: tag };
  }
  return {};
}

/**
 * Message multicast FCM complet (notification + data + options plateforme).
 * `data.tag` est recopié pour que l'app réutilise le même identifiant quand
 * elle affiche la notif elle-même au premier plan.
 */
export function buildMulticastMessage(params: {
  tokens: string[];
  payload: PushPayload;
}): MulticastMessage {
  const { payload } = params;
  const grouping = pushGrouping(payload.data);
  const data: Record<string, string> = {
    ...payload.data,
    title: payload.title,
    body: payload.body,
  };
  if (grouping.tag) data.tag = grouping.tag;

  return {
    tokens: params.tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data,
    android: {
      priority: "high",
      notification: {
        // Silhouette monochrome `@drawable/ic_notification` (pas le launcher
        // coloré : Android n'utilise que l'alpha → sinon disque / carré blanc).
        icon: "ic_notification",
        color: "#134A7D", // ViroColors.primary600
        channelId: androidChannelId(payload.preferenceKey),
        ...(grouping.tag ? { tag: grouping.tag } : {}),
      },
    },
    apns: {
      ...(grouping.tag
        ? { headers: { "apns-collapse-id": grouping.tag.slice(0, 64) } }
        : {}),
      payload: {
        aps: {
          sound: "default",
          ...(grouping.threadId ? { threadId: grouping.threadId } : {}),
        },
      },
    },
    webpush: {
      fcmOptions: {
        link: payload.data.webPath || "/",
      },
    },
  };
}
