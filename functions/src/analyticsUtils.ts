import type { FirestoreDatabaseId } from "./db";

/**
 * Clés publiques PostHog (hébergement UE) — mêmes projets que l'app
 * (`ProjectConfig.posthogProdApiKey` / `posthogDevApiKey`) : `v2-prod` → prod,
 * `v2-dev` → dev.
 */
export const POSTHOG_PROD_API_KEY =
  "phc_wMm5hy9zFdbcsgUXoibRunuxb2crXmL6iLnLSMLHBvBv";
export const POSTHOG_DEV_API_KEY =
  "phc_xwPxt9Kkn3qMDzf3utNvtpuPrrrfQ9Pe4KeY8ZenJ2ey";
export const POSTHOG_CAPTURE_URL = "https://eu.i.posthog.com/i/v0/e/";

/** Type de groupe PostHog du club (aligné app / portail). */
export const CLUB_GROUP_TYPE = "club";

/**
 * Événements envoyés par les Functions (plan de taggage :
 * `docs/analytics_events.csv`).
 */
export const ServerAnalyticsEvents = {
  signupCompleted: "signup_completed",
  clubCreated: "club_created",
  invitationSent: "invitation_sent",
  invitationAccepted: "invitation_accepted",
  joinCodeUsed: "join_code_used",
  guardianLinked: "guardian_linked",
  eventCreated: "event_created",
  convocationSent: "convocation_sent",
  rsvpSet: "rsvp_set",
  feePaymentSucceeded: "fee_payment_succeeded",
} as const;

export type ServerAnalyticsEvent =
  (typeof ServerAnalyticsEvents)[keyof typeof ServerAnalyticsEvents];

export type ServerAnalyticsProperties = Record<string, string | number | boolean>;

/** `distinct_id` des événements serveur sans club (ex. inscription). */
export const ANONYMOUS_SERVER_DISTINCT_ID = "server_anonymous";

/**
 * `distinct_id` technique d'un événement serveur : le club, jamais une
 * personne (le consentement analytics n'est connu que des clients).
 */
export function serverDistinctId(clubId?: string): string {
  return clubId ? `club_${clubId}` : ANONYMOUS_SERVER_DISTINCT_ID;
}

/**
 * Corps de la requête de capture PostHog pour [event], rattaché au groupe
 * `club` [clubId] s'il est fourni, sans profil personne ni PII.
 */
export function buildServerEventPayload(params: {
  databaseId: FirestoreDatabaseId;
  event: ServerAnalyticsEvent;
  clubId?: string;
  properties?: ServerAnalyticsProperties;
  timestamp?: Date;
}): Record<string, unknown> {
  const isProd = params.databaseId === "v2-prod";
  return {
    api_key: isProd ? POSTHOG_PROD_API_KEY : POSTHOG_DEV_API_KEY,
    event: params.event,
    distinct_id: serverDistinctId(params.clubId),
    timestamp: (params.timestamp ?? new Date()).toISOString(),
    properties: {
      ...params.properties,
      surface: "server",
      app_env: isProd ? "release" : "debug",
      ...(params.clubId
        ? { $groups: { [CLUB_GROUP_TYPE]: params.clubId } }
        : {}),
      $process_person_profile: false,
      $lib: "viroteam-functions",
    },
  };
}
