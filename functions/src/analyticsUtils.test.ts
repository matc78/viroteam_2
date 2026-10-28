import test from "node:test";
import assert from "node:assert/strict";
import {
  POSTHOG_DEV_API_KEY,
  POSTHOG_PROD_API_KEY,
  ServerAnalyticsEvents,
  buildServerEventPayload,
  callerClientFromOrigin,
} from "./analyticsUtils";

test("buildServerEventPayload : base prod → projet prod, groupe club sans personne", () => {
  const payload = buildServerEventPayload({
    databaseId: "v2-prod",
    event: ServerAnalyticsEvents.rsvpSet,
    clubId: "club42",
    properties: { status: "yes", for_child: true },
    timestamp: new Date("2026-10-23T10:00:00Z"),
  });
  assert.equal(payload.api_key, POSTHOG_PROD_API_KEY);
  assert.equal(payload.event, "rsvp_set");
  assert.equal(payload.distinct_id, "club_club42");
  assert.equal(payload.timestamp, "2026-10-23T10:00:00.000Z");
  assert.deepEqual(payload.properties, {
    status: "yes",
    for_child: true,
    surface: "server",
    app_env: "release",
    $groups: { club: "club42" },
    $process_person_profile: false,
    $lib: "viroteam-functions",
  });
});

test("buildServerEventPayload : base dev → projet dev, propriétés réservées non écrasables", () => {
  const payload = buildServerEventPayload({
    databaseId: "v2-dev",
    event: ServerAnalyticsEvents.eventCreated,
    clubId: "c1",
    properties: { surface: "app", event_type: "match" },
  });
  const properties = payload.properties as Record<string, unknown>;
  assert.equal(payload.api_key, POSTHOG_DEV_API_KEY);
  assert.equal(properties.surface, "server");
  assert.equal(properties.app_env, "debug");
  assert.equal(properties.event_type, "match");
});

test("buildServerEventPayload : client de la callable → propriété client, absente sinon", () => {
  const fromPortal = buildServerEventPayload({
    databaseId: "v2-prod",
    event: ServerAnalyticsEvents.invitationSent,
    clubId: "c1",
    client: "portal",
  });
  const fromTrigger = buildServerEventPayload({
    databaseId: "v2-prod",
    event: ServerAnalyticsEvents.eventCreated,
    clubId: "c1",
  });
  assert.equal((fromPortal.properties as Record<string, unknown>).client, "portal");
  assert.equal("client" in (fromTrigger.properties as Record<string, unknown>), false);
});

test("callerClientFromOrigin : en-tête Origin (navigateur) → portal, absent → app", () => {
  assert.equal(callerClientFromOrigin("https://portal.viroteam.fr"), "portal");
  assert.equal(callerClientFromOrigin(["http://localhost:3000"]), "portal");
  assert.equal(callerClientFromOrigin(undefined), "app");
  assert.equal(callerClientFromOrigin(""), "app");
});

test("buildServerEventPayload : sans club → distinct_id anonyme, aucun groupe", () => {
  const payload = buildServerEventPayload({
    databaseId: "v2-prod",
    event: ServerAnalyticsEvents.signupCompleted,
    properties: { method: "password" },
  });
  const properties = payload.properties as Record<string, unknown>;
  assert.equal(payload.distinct_id, "server_anonymous");
  assert.equal(properties.$groups, undefined);
  assert.equal(properties.$process_person_profile, false);
  assert.equal(properties.method, "password");
});
