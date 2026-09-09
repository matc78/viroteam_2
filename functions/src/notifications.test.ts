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
  feeReminderCopy,
  preferenceOffWarning,
  rsvpStatusLabel,
  truncatePushBody,
} from "./notifications/copy";
import {
  addDaysToDateId,
  calendarDaysUntil,
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
import { MANUAL_PUSH_COOLDOWN_MS, RSVP_NOTIFY_DEBOUNCE_MS } from "./notifications/types";

test("truncatePushBody tronque avec ellipse", () => {
  assert.equal(truncatePushBody("court"), "court");
  const long = "a".repeat(200);
  const out = truncatePushBody(long, 20);
  assert.equal(out.length, 20);
  assert.ok(out.endsWith("…"));
});

test("copies event / fee / annonce", () => {
  assert.equal(eventReminderJ7Copy("Match").title, "Rappel — dans une semaine");
  assert.equal(eventReminderJ2Copy("Match").body, "Match");
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
  assert.equal(
    eventRsvpChangedCopy({
      memberName: "Marie",
      status: "yes",
      eventTitle: "Entraînement",
    }).title,
    "Réponse RSVP",
  );
  assert.match(
    eventRsvpChangedCopy({
      memberName: "Marie",
      status: "yes",
      eventTitle: "Entraînement",
    }).body,
    /Marie : Oui — Entraînement/,
  );
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

test("preferenceOffWarning couvre les 3 clés", () => {
  assert.match(preferenceOffWarning("events"), /RSVP/);
  assert.match(preferenceOffWarning("announcements"), /annonces/);
  assert.match(preferenceOffWarning("fees"), /cotisation/);
});

test("deep links et dateId", () => {
  assert.equal(dateIdToIsoDate("20260908"), "2026-09-08");
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
  assert.equal(RSVP_NOTIFY_DEBOUNCE_MS, 60 * 1000);
});

test("prefs : défaut opt-in + filtre + rate limit", () => {
  assert.deepEqual(parseNotificationPreferences(undefined), {
    events: true,
    announcements: true,
    fees: true,
  });
  assert.equal(parseNotificationPreferences({ events: false }).events, false);

  const filtered = filterUidsByPreference({
    uidPrefs: new Map([
      ["a", { events: true, announcements: true, fees: true }],
      ["b", { events: false, announcements: true, fees: true }],
    ]),
    uids: ["a", "b", "c"],
    key: "events",
  });
  assert.deepEqual(filtered, ["a", "c"]);

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
