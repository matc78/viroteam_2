import {
  POSTHOG_CAPTURE_URL,
  ServerAnalyticsEvents,
  buildServerEventPayload,
  type ServerAnalyticsEvent,
  type ServerAnalyticsProperties,
} from "./analyticsUtils";
import { currentDatabaseId, db } from "./db";

export { ServerAnalyticsEvents };

const CAPTURE_TIMEOUT_MS = 2000;

/**
 * Envoie [event] à PostHog pour le club [clubId] (projet prod ou dev selon la
 * base du contexte). Best-effort : jamais d'exception, délai court, à `await`
 * avant de rendre la main (une Function figée après réponse perdrait l'envoi).
 */
export async function captureClubEvent(params: {
  clubId: string;
  event: ServerAnalyticsEvent;
  properties?: ServerAnalyticsProperties;
}): Promise<void> {
  if (!params.clubId) return;
  await sendServerEvent(params);
}

/**
 * `convocation_sent` uniquement si au moins une push est réellement partie
 * ([recipientCount] > 0).
 */
export async function captureConvocationSent(
  clubId: string,
  trigger: string,
  recipientCount: number,
): Promise<void> {
  if (recipientCount <= 0) return;
  await captureClubEvent({
    clubId,
    event: ServerAnalyticsEvents.convocationSent,
    properties: { trigger, recipient_count: recipientCount },
  });
}

/**
 * Envoie [event] sans club ni personne (compteur anonyme, ex. inscription).
 * Mêmes garanties que [captureClubEvent].
 */
export async function captureAnonymousEvent(params: {
  event: ServerAnalyticsEvent;
  properties?: ServerAnalyticsProperties;
}): Promise<void> {
  await sendServerEvent(params);
}

/**
 * Nombre de membres du club après une arrivée (propriété `member_count` de
 * l'entonnoir d'activation) ; 0 si illisible.
 */
export async function clubMemberCount(clubId: string): Promise<number> {
  try {
    const snap = await db().collection("clubs").doc(clubId).get();
    return Number(snap.data()?.memberCount ?? 0) || 0;
  } catch {
    return 0;
  }
}

async function sendServerEvent(params: {
  clubId?: string;
  event: ServerAnalyticsEvent;
  properties?: ServerAnalyticsProperties;
}): Promise<void> {
  try {
    const payload = buildServerEventPayload({
      databaseId: currentDatabaseId(),
      event: params.event,
      clubId: params.clubId,
      properties: params.properties,
    });
    const response = await fetch(POSTHOG_CAPTURE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn("sendServerEvent rejected", {
        event: params.event,
        status: response.status,
      });
    }
  } catch (error) {
    // L'analytics ne doit jamais faire échouer l'action métier.
    console.warn("sendServerEvent failed", { event: params.event, error });
  }
}
