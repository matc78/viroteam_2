import test from "node:test";
import assert from "node:assert/strict";
import {
  announcementPublishedCopy,
  eventCanceledCopy,
  eventManualPushCopy,
  eventModifiedCopy,
  eventPostponedCopy,
  eventReminderJ2Copy,
  eventReminderJ7Copy,
  eventRsvpChangedCopy,
  eventTypePushLabel,
  feeReminderCopy,
  formatMemberShortName,
  preferenceOffWarning,
  rsvpStatusLabel,
  truncatePushBody,
} from "./notifications/copy";
import {
  addDaysToDateId,
  calendarDaysUntil,
  dateIdToDayMonthLabel,
  dateIdToIsoDate,
  feesDeepLink,
  homeDeepLink,
  parisDateId,
  planningDeepLink,
} from "./notifications/deepLinks";
import {
  immediateReminderKinds,
  isEventContentModified,
  isEventPostponedChange,
  isOnlyPushBookkeepingChange,
  listRsvpStatusChanges,
} from "./notifications/eventChange";
import {
  canSendManualPush,
  filterUidsByPreference,
  parseNotificationPreferences,
} from "./notifications/prefs";
import {
  ANDROID_CHANNEL_IDS,
  androidChannelId,
  buildMulticastMessage,
  pushGrouping,
} from "./notifications/fcmMessage";
import { MANUAL_PUSH_COOLDOWN_MS, RSVP_NOTIFY_DEBOUNCE_MS } from "./notifications/types";

test("truncatePushBody tronque avec ellipse", () => {
  assert.equal(truncatePushBody("court"), "court");
  const long = "a".repeat(200);
  const out = truncatePushBody(long, 20);
  assert.equal(out.length, 20);
  assert.ok(out.endsWith("…"));
});

test("copies event / fee / annonce", () => {
  assert.equal(eventReminderJ7Copy("Match", "19/09").title, "Rappel — 19/09");
  assert.equal(eventReminderJ2Copy("Match", "12/09").title, "Rappel — 12/09");
  assert.equal(eventReminderJ2Copy("Match", "12/09").body, "Match");
  assert.match(eventManualPushCopy({
    title: "Entr.",
    dateLabel: "lun. 8 sept.",
    startTime: "18:00",
  }).body, /18:00/);
  assert.equal(eventCanceledCopy("X").title, "Événement annulé");
  assert.match(eventPostponedCopy({
    title: "X",
    dateLabel: "mar. 9",
    startTime: "19:00",
  }).body, /nouvelle date/);
  assert.equal(eventModifiedCopy("X").title, "Événement modifié");
  assert.equal(rsvpStatusLabel("yes"), "Oui");
  assert.equal(rsvpStatusLabel("maybe"), "Peut-être");
  assert.equal(eventTypePushLabel("training"), "Entraînement");
  assert.equal(eventTypePushLabel("match"), "Match");
  assert.equal(
    eventRsvpChangedCopy({
      responses: [{ memberName: "Marie D.", status: "yes" }],
      eventTitle: "Séniors Masculine 6x6",
      eventType: "training",
      dateLabel: "25/10",
    }).title,
    "Entraînement 25/10",
  );
  assert.match(
    eventRsvpChangedCopy({
      responses: [{ memberName: "Marie D.", status: "yes" }],
      eventTitle: "Séniors Masculine 6x6",
      eventType: "training",
      dateLabel: "25/10",
    }).body,
    /Marie D\. : Oui — Séniors Masculine 6x6/,
  );
  assert.equal(
    eventRsvpChangedCopy({
      responses: [
        { memberName: "Marie D.", status: "yes" },
        { memberName: "Paul G.", status: "no" },
      ],
      eventTitle: "Séniors",
      eventType: "match",
      dateLabel: "30/10",
    }).title,
    "Match 30/10",
  );
  assert.match(
    eventRsvpChangedCopy({
      responses: [
        { memberName: "Marie D.", status: "yes" },
        { memberName: "Paul G.", status: "no" },
      ],
      eventTitle: "Séniors",
      eventType: "match",
      dateLabel: "30/10",
    }).body,
    /2 réponses — Marie D\. : Oui, Paul G\. : Non — Séniors/,
  );
  assert.equal(
    formatMemberShortName({ firstName: "Matia", lastName: "Cilly" }),
    "Matia C.",
  );
  assert.equal(
    formatMemberShortName({ displayName: "Paul DEL PERUGIA" }),
    "Paul D.",
  );
  assert.equal(formatMemberShortName({}), "Un membre");
  assert.equal(announcementPublishedCopy("Hello world").title, "Nouvelle annonce");
  assert.equal(feeReminderCopy({
    seasonLabel: "2025",
    deadlineLabel: "1 oct.",
    overdue: false,
  }).title, "Rappel cotisation");
  assert.equal(feeReminderCopy({
    seasonLabel: "2025",
    deadlineLabel: "1 oct.",
    overdue: true,
  }).title, "Cotisation en retard");
});

test("preferenceOffWarning couvre les 4 clés", () => {
  assert.match(preferenceOffWarning("events"), /rappels d’événements/);
  assert.match(preferenceOffWarning("announcements"), /annonces/);
  assert.match(preferenceOffWarning("fees"), /cotisation/);
  assert.match(preferenceOffWarning("rsvp"), /RSVP/);
});

test("deep links et dateId", () => {
  assert.equal(dateIdToIsoDate("20260908"), "2026-09-08");
  assert.equal(dateIdToDayMonthLabel("20260908"), "08/09");
  assert.equal(dateIdToDayMonthLabel("20261019"), "19/10");
  assert.equal(
    planningDeepLink("c1", "20260908"),
    "viroteam://planning?clubId=c1&date=2026-09-08",
  );
  assert.equal(homeDeepLink("c1"), "viroteam://home?clubId=c1");
  assert.equal(feesDeepLink("c1"), "viroteam://fees?clubId=c1");
  assert.equal(addDaysToDateId("20260908", 7), "20260915");
  assert.equal(addDaysToDateId("20260908", 2), "20260910");
});

test("calendarDaysUntil et parisDateId", () => {
  const now = new Date("2026-09-08T12:00:00+02:00");
  assert.equal(parisDateId(now), "20260908");
  assert.equal(calendarDaysUntil({ now, eventDateId: "20260915" }), 7);
  assert.equal(calendarDaysUntil({ now, eventDateId: "20260910" }), 2);
});

test("immediateReminderKinds", () => {
  assert.deepEqual(immediateReminderKinds(10), []);
  assert.deepEqual(immediateReminderKinds(7), ["j7"]);
  assert.deepEqual(immediateReminderKinds(5), ["j7"]);
  assert.deepEqual(immediateReminderKinds(2), ["j2"]);
  assert.deepEqual(immediateReminderKinds(0), ["j2"]);
  assert.deepEqual(immediateReminderKinds(-1), []);
});

test("isEventPostponedChange / content modified / bookkeeping", () => {
  assert.equal(
    isEventPostponedChange(
      { dateId: "20260908", startTime: "18:00" },
      { dateId: "20260909", startTime: "18:00" },
    ),
    true,
  );
  assert.equal(
    isEventPostponedChange(
      { dateId: "20260908", startTime: "18:00", title: "A" },
      { dateId: "20260908", startTime: "18:00", title: "B" },
    ),
    false,
  );
  assert.equal(
    isEventContentModified(
      { title: "A", location: "Gym" },
      { title: "B", location: "Gym" },
    ),
    true,
  );
  assert.equal(
    isOnlyPushBookkeepingChange(
      { title: "A", reminderSentJ7: true },
      { title: "A", reminderSentJ7: false, reminderSentJ2: true },
    ),
    true,
  );
  assert.equal(
    isOnlyPushBookkeepingChange(
      { title: "A", reminderSentJ7: true },
      { title: "B", reminderSentJ7: false },
    ),
    false,
  );
  assert.equal(
    isOnlyPushBookkeepingChange(
      { title: "A", rsvpNotifyDueAt: null },
      {
        title: "A",
        rsvpNotifyDueAt: { toMillis: () => 1 },
        rsvpNotifyPending: { u1: { status: "yes", version: 1 } },
      },
    ),
    true,
  );
});

test("listRsvpStatusChanges détecte les deltas (ignore les suppressions)", () => {
  assert.deepEqual(
    listRsvpStatusChanges(
      { rsvp: { a: "yes", b: "no" } },
      { rsvp: { a: "maybe", b: "no" } },
    ),
    [{ memberId: "a", status: "maybe" }],
  );
  assert.deepEqual(
    listRsvpStatusChanges({ rsvp: {} }, { rsvp: { a: "yes" } }),
    [{ memberId: "a", status: "yes" }],
  );
  // Suppression de clé = nettoyage audience, pas une réponse utilisateur.
  assert.deepEqual(
    listRsvpStatusChanges({ rsvp: { a: "yes" } }, { rsvp: {} }),
    [],
  );
  assert.equal(RSVP_NOTIFY_DEBOUNCE_MS, 5 * 1000);
});

test("prefs : défaut opt-in + filtre + rate limit", () => {
  assert.deepEqual(parseNotificationPreferences(undefined), {
    events: true,
    announcements: true,
    fees: true,
    rsvp: true,
    chat: true,
  });
  assert.equal(parseNotificationPreferences({ events: false }).events, false);
  assert.equal(parseNotificationPreferences({}).rsvp, true);
  assert.equal(parseNotificationPreferences({ rsvp: false }).rsvp, false);

  const filtered = filterUidsByPreference({
    uidPrefs: new Map([
      [
        "a",
        { events: true, announcements: true, fees: true, rsvp: true, chat: true },
      ],
      [
        "b",
        { events: false, announcements: true, fees: true, rsvp: true, chat: true },
      ],
    ]),
    uids: ["a", "b", "c"],
    key: "events",
  });
  assert.deepEqual(filtered, ["a", "c"]);

  const filteredRsvp = filterUidsByPreference({
    uidPrefs: new Map([
      [
        "a",
        { events: true, announcements: true, fees: true, rsvp: true, chat: true },
      ],
      [
        "b",
        { events: true, announcements: true, fees: true, rsvp: false, chat: true },
      ],
    ]),
    uids: ["a", "b", "c"],
    key: "rsvp",
  });
  assert.deepEqual(filteredRsvp, ["a", "c"]);

  assert.equal(
    canSendManualPush({
      lastManualPushAtMs: null,
      nowMs: 1000,
      cooldownMs: MANUAL_PUSH_COOLDOWN_MS,
    }),
    true,
  );
  assert.equal(
    canSendManualPush({
      lastManualPushAtMs: 0,
      nowMs: MANUAL_PUSH_COOLDOWN_MS - 1,
      cooldownMs: MANUAL_PUSH_COOLDOWN_MS,
    }),
    false,
  );
  assert.equal(
    canSendManualPush({
      lastManualPushAtMs: 0,
      nowMs: MANUAL_PUSH_COOLDOWN_MS,
      cooldownMs: MANUAL_PUSH_COOLDOWN_MS,
    }),
    true,
  );
});

test("pushGrouping : tag de remplacement par entité, thread sans tag pour le chat", () => {
  assert.deepEqual(
    pushGrouping({ type: "event_modified", eventId: "e1" }),
    { tag: "event_e1", threadId: "event_e1" },
  );
  assert.deepEqual(
    pushGrouping({ type: "event_rsvp_changed", eventId: "e1", memberId: "m1" }),
    { tag: "rsvp_e1", threadId: "event_e1" },
  );
  assert.deepEqual(
    pushGrouping({ type: "announcement_published", announcementId: "a1" }),
    { tag: "announcement_a1", threadId: "announcements" },
  );
  assert.deepEqual(
    pushGrouping({ type: "fee_reminder", seasonId: "s1" }),
    { tag: "fees_s1", threadId: "fees_s1" },
  );
  assert.deepEqual(
    pushGrouping({ type: "chat_message", conversationId: "c1" }),
    { threadId: "chat_c1" },
  );
  assert.deepEqual(pushGrouping({ type: "inconnu" }), {});
});

test("buildMulticastMessage : canal Android, tag, collapse-id et data.tag", () => {
  const message = buildMulticastMessage({
    tokens: ["t1"],
    payload: {
      title: "Titre",
      body: "Corps",
      preferenceKey: "announcements",
      data: {
        type: "announcement_published",
        announcementId: "a1",
        webPath: "/home",
      },
    },
  });
  assert.equal(message.android?.notification?.channelId, "viro_announcements");
  assert.equal(message.android?.notification?.icon, "ic_notification");
  assert.equal(message.android?.notification?.color, "#134A7D");
  assert.equal(message.android?.notification?.tag, "announcement_a1");
  assert.equal(message.apns?.headers?.["apns-collapse-id"], "announcement_a1");
  assert.equal(message.apns?.payload?.aps.threadId, "announcements");
  assert.equal(message.data?.tag, "announcement_a1");
  assert.equal(message.data?.title, "Titre");
  assert.equal(message.webpush?.fcmOptions?.link, "/home");

  const chat = buildMulticastMessage({
    tokens: ["t1"],
    payload: {
      title: "T",
      body: "B",
      preferenceKey: "chat",
      data: { type: "chat_message", conversationId: "c1" },
    },
  });
  assert.equal(chat.android?.notification?.channelId, "viro_chat");
  assert.equal(chat.android?.notification?.tag, undefined);
  assert.equal(chat.apns?.headers, undefined);
  assert.equal(chat.data?.tag, undefined);
});

test("androidChannelId couvre chaque clé de préférence", () => {
  const keys = ["events", "announcements", "chat", "fees", "rsvp"] as const;
  for (const key of keys) {
    assert.match(androidChannelId(key), /^viro_/);
  }
  assert.equal(new Set(Object.values(ANDROID_CHANNEL_IDS)).size, keys.length);
});
