import test from "node:test";
import assert from "node:assert/strict";
import type { EventAudienceEntry } from "./notifications/audience";
import { tallyRsvp } from "./notifications/audience";
import {
  announcementPublishedCopy,
  childRsvpConfirmationCopy,
  eventCanceledCopy,
  eventCreatedCopy,
  eventDayOfReminderCopy,
  eventManualPushCopy,
  eventModifiedCopy,
  eventPostponedCopy,
  eventCoachJ2SummaryCopy,
  eventReminderJ2Copy,
  eventReminderJ2MaybeCopy,
  eventReminderJ7Copy,
  eventReminderJ7MaybeCopy,
  eventRsvpChangedCopy,
  eventTypePushLabel,
  feeReminderCopy,
  formatMemberShortName,
  formatRsvpTally,
  preferenceOffWarning,
  rsvpStatusLabel,
  truncatePushBody,
  weeklyDigestCopy,
  type EventPushContext,
} from "./notifications/copy";
import {
  addDaysToDateId,
  calendarDaysUntil,
  dateIdToDayMonthLabel,
  dateIdToIsoDate,
  dateIdToShortDayLabel,
  dateIdWeekday,
  feesDeepLink,
  formatTimeFr,
  homeDeepLink,
  parisDateId,
  planningDeepLink,
  planningWebPath,
} from "./notifications/deepLinks";
import {
  creationReminderFlags,
  dayOfReminderIsEve,
  describeChanges,
  isEventContentModified,
  isEventPostponedChange,
  isOnlyPushBookkeepingChange,
  listAddedTeamMemberIds,
  listModifiedEventFields,
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
import {
  addEventToDigests,
  eveningReminderSlots,
  morningReminderSlots,
  type DigestRecipient,
} from "./notifications/reminderSlots";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  MANUAL_PUSH_COOLDOWN_MS,
  RSVP_NOTIFY_DEBOUNCE_MS,
} from "./notifications/types";

const training: EventPushContext = {
  title: "U15",
  type: "training",
  dayLabel: "jeu. 23/10",
  startTime: "18h00",
  location: "Gymnase Jean Moulin",
};

const forLeo: EventPushContext = { ...training, childFirstName: "Léo" };

test("truncatePushBody tronque avec ellipse", () => {
  assert.equal(truncatePushBody("court"), "court");
  const long = "a".repeat(200);
  const out = truncatePushBody(long, 20);
  assert.equal(out.length, 20);
  assert.ok(out.endsWith("…"));
});

test("rappels J-7 / J-2 : quoi, quand, et la réponse attendue", () => {
  const j7 = eventReminderJ7Copy({ ...training, type: "tournament", title: "Tournoi de Noël" });
  assert.equal(j7.title, "Tournoi de Noël · Tournoi jeu. 23/10 à 18h00");
  assert.match(j7.body, /^Dans une semaine · Gymnase Jean Moulin\. Tu viens \?/);

  const j2 = eventReminderJ2Copy(training);
  assert.equal(j2.title, "U15 · Entraînement jeu. 23/10 à 18h00");
  assert.equal(j2.body, "Toujours pas de réponse : tu viens ? Un tap suffit.");
  assert.notEqual(j2.body, j7.body);

  // Parent : l'enfant remplace l'équipe dans le titre.
  const j2Parent = eventReminderJ2Copy(forLeo);
  assert.equal(j2Parent.title, "Léo · Entraînement jeu. 23/10 à 18h00");
  assert.match(j2Parent.body, /pour Léo/);
  assert.match(eventReminderJ7Copy(forLeo).body, /Léo vient \?/);

  // Titre libre identique au type : pas de répétition.
  assert.equal(
    eventReminderJ2Copy({ ...training, title: "Entraînement" }).title,
    "Entraînement jeu. 23/10 à 18h00",
  );
});

test("rappel jour J : aujourd'hui / demain, RDV, relance si pas de réponse", () => {
  const today = eventDayOfReminderCopy({
    ...training,
    type: "match",
    startTime: "15h00",
    meetingTime: "14h15",
    when: "today",
    rsvp: "yes",
  });
  assert.equal(today.title, "C’est aujourd’hui : Match à 15h00");
  assert.equal(today.body, "U15 · RDV 14h15 · Gymnase Jean Moulin");

  const tomorrow = eventDayOfReminderCopy({ ...training, when: "tomorrow", rsvp: "none" });
  assert.equal(tomorrow.title, "Demain : Entraînement à 18h00");
  assert.match(tomorrow.body, /Pense à répondre\.$/);

  const parent = eventDayOfReminderCopy({ ...forLeo, when: "today", rsvp: "none" });
  assert.equal(parent.title, "C’est aujourd’hui pour Léo : Entraînement à 18h00");
  assert.match(parent.body, /Pense à répondre pour Léo\.$/);
});

test("création, annulation, report, modification, push coach", () => {
  const created = eventCreatedCopy({ ...training, type: "match", dayLabel: "sam. 25/10" });
  assert.equal(created.title, "Nouvelle convocation · Match sam. 25/10");
  assert.equal(created.body, "U15 · 18h00 · Gymnase Jean Moulin. Tu viens ?");
  assert.match(eventCreatedCopy(forLeo).title, /^Nouvelle convocation pour Léo/);

  const canceled = eventCanceledCopy(training);
  assert.equal(canceled.title, "Annulé · Entraînement jeu. 23/10");
  assert.equal(canceled.body, "U15 — L’entraînement de 18h00 n’aura pas lieu.");
  assert.equal(
    eventCanceledCopy({ ...training, type: "meeting", title: "", startTime: undefined }).body,
    "La réunion n’aura pas lieu.",
  );

  const postponed = eventPostponedCopy({ ...training, dayLabel: "lun. 27/10" });
  assert.equal(postponed.title, "Changement de date · Entraînement");
  assert.equal(postponed.body, "U15 — Maintenant lun. 27/10 à 18h00. Vérifie ta dispo.");
  assert.match(eventPostponedCopy(forLeo).body, /Vérifie la dispo de Léo\.$/);

  const modified = eventModifiedCopy({
    ...training,
    changes: [
      { field: "location", value: "Salle B" },
      { field: "meetingTime", value: "17h30" },
    ],
  });
  assert.equal(modified.title, "Entraînement jeu. 23/10 à 18h00 modifié");
  assert.equal(modified.body, "Nouveau lieu : Salle B · RDV à 17h30.");

  assert.equal(
    eventManualPushCopy({ ...training, rsvp: "none" }).body,
    "Entraînement jeu. 23/10 à 18h00 · Gymnase Jean Moulin — tu viens ?",
  );
  assert.equal(eventManualPushCopy({ ...training, rsvp: "yes" }).title, "U15 · Rappel du coach");
  assert.doesNotMatch(eventManualPushCopy({ ...training, rsvp: "yes" }).body, /\?/);
});

test("RSVP : digest staff avec décompte, confirmation parent", () => {
  const tally = { yes: 12, no: 3, maybe: 0, none: 4 };
  assert.equal(formatRsvpTally(tally), "12 oui, 3 non, 4 sans réponse");

  const single = eventRsvpChangedCopy({
    responses: [{ memberName: "Marie D.", status: "yes" }],
    ctx: training,
    tally,
  });
  assert.equal(single.title, "U15 · Entraînement jeu. 23/10 à 18h00");
  assert.equal(single.body, "Marie D. vient · 12 oui, 3 non, 4 sans réponse");

  const digest = eventRsvpChangedCopy({
    responses: [
      { memberName: "Marie D.", status: "yes" },
      { memberName: "Paul G.", status: "no" },
      { memberName: "Zoé R.", status: "maybe" },
    ],
    ctx: forLeo,
    tally,
  });
  // Le digest staff ne prend jamais le prénom d'un enfant.
  assert.match(digest.title, /^U15 · /);
  assert.match(digest.body, /^3 nouvelles réponses · /);

  assert.equal(
    childRsvpConfirmationCopy({ ctx: forLeo, status: "no" }).body,
    "Réponse enregistrée pour Léo : Non.",
  );
  assert.equal(rsvpStatusLabel("maybe"), "Peut-être");
  assert.equal(eventTypePushLabel("Réunion"), "Réunion");
  assert.equal(formatMemberShortName({ firstName: "Matia", lastName: "Cilly" }), "Matia C.");
  assert.equal(formatMemberShortName({ displayName: "Paul DEL PERUGIA" }), "Paul D.");
  assert.equal(formatMemberShortName({}), "Un membre");
});

test("récap hebdo : rien sans event, réponses attendues sinon", () => {
  assert.equal(weeklyDigestCopy([]), null);
  const copy = weeklyDigestCopy([
    { type: "training", dayLabel: "lun. 27/10", awaitingResponse: false },
    { type: "training", dayLabel: "mer. 29/10", awaitingResponse: true },
    { type: "match", dayLabel: "sam. 1/11", awaitingResponse: true },
  ]);
  assert.equal(copy?.title, "Ta semaine : 1 match, 2 entraînements");
  assert.equal(
    copy?.body,
    "2 réponses attendues (mer. 29/10, sam. 1/11). Jette un œil au planning.",
  );
  assert.equal(
    weeklyDigestCopy([{ type: "meeting", dayLabel: "jeu. 30/10", awaitingResponse: false }])?.body,
    "Tout est répondu, bonne semaine !",
  );
});

test("annonce et cotisation : club dans le titre, tutoiement", () => {
  assert.equal(
    announcementPublishedCopy({ clubName: "VB Lyon", message: "Hello" }).title,
    "VB Lyon · Nouvelle annonce",
  );
  const fee = feeReminderCopy({
    clubName: "VB Lyon",
    seasonLabel: "2026-2027",
    deadlineLabel: "30/11",
    overdue: false,
  });
  assert.equal(fee.title, "VB Lyon · Cotisation 2026-2027");
  assert.equal(fee.body, "À régler avant le 30/11.");
  assert.equal(
    feeReminderCopy({ clubName: "", seasonLabel: "", overdue: false }).body,
    "Pense à régler ta cotisation.",
  );
  assert.match(
    feeReminderCopy({ clubName: "X", seasonLabel: "S", deadlineLabel: "15/10", overdue: true }).body,
    /^Date limite dépassée \(15\/10\)/,
  );
});

test("preferenceOffWarning : tutoiement sur chaque clé", () => {
  for (const key of ["events", "announcements", "fees", "rsvp", "chat", "weeklyDigest"] as const) {
    assert.match(preferenceOffWarning(key), /^Tu ne recevras plus/);
  }
  assert.match(preferenceOffWarning("weeklyDigest"), /récap/);
});

test("deep links, dateId et libellés", () => {
  assert.equal(dateIdToIsoDate("20260908"), "2026-09-08");
  assert.equal(dateIdToDayMonthLabel("20261019"), "19/10");
  assert.equal(
    planningDeepLink("c1", "20260908"),
    "viroteam://planning?clubId=c1&date=2026-09-08",
  );
  assert.equal(
    planningDeepLink("c1", "20260908", { eventId: "e1", memberId: "m 1" }),
    "viroteam://planning?clubId=c1&date=2026-09-08&eventId=e1&memberId=m%201",
  );
  assert.equal(
    planningWebPath("c1", "20260908", { eventId: "e1" }),
    "/planning?clubId=c1&date=2026-09-08&eventId=e1",
  );
  assert.equal(homeDeepLink("c1"), "viroteam://home?clubId=c1");
  assert.equal(feesDeepLink("c1"), "viroteam://fees?clubId=c1");
  assert.equal(addDaysToDateId("20260908", 7), "20260915");
  assert.equal(dateIdToShortDayLabel("20261022"), "jeu. 22/10");
  assert.equal(dateIdWeekday("20261025"), 0);
  assert.equal(dateIdWeekday("20261026"), 1);
  assert.equal(formatTimeFr("18:00"), "18h00");
  assert.equal(formatTimeFr("9:30"), "9h30");
  assert.equal(formatTimeFr(""), "");
});

test("calendarDaysUntil et parisDateId", () => {
  const now = new Date("2026-09-08T12:00:00+02:00");
  assert.equal(parisDateId(now), "20260908");
  assert.equal(calendarDaysUntil({ now, eventDateId: "20260915" }), 7);
  assert.equal(calendarDaysUntil({ now, eventDateId: "20260910" }), 2);
});

test("creationReminderFlags : la push de création couvre les rappels de sa fenêtre", () => {
  assert.deepEqual(creationReminderFlags(10), []);
  assert.deepEqual(creationReminderFlags(7), ["reminderSentJ7"]);
  assert.deepEqual(creationReminderFlags(2), ["reminderSentJ7", "reminderSentJ2"]);
  assert.deepEqual(creationReminderFlags(0), [
    "reminderSentJ7",
    "reminderSentJ2",
    "reminderSentDay",
  ]);
  assert.deepEqual(creationReminderFlags(-1), []);
});

test("dayOfReminderIsEve : avant 10h00, rappel la veille", () => {
  assert.equal(dayOfReminderIsEve("9:30"), true);
  assert.equal(dayOfReminderIsEve("09:59"), true);
  assert.equal(dayOfReminderIsEve("10:00"), false);
  assert.equal(dayOfReminderIsEve("18:00"), false);
  assert.equal(dayOfReminderIsEve(undefined), false);
});

test("créneaux du soir : J-2 tous les jours (lundi/mardi compris), dimanche réservé au récap", () => {
  // Samedi 24/10 : J-2 = lundi 26, J-7 = samedi 31, veille = dimanche 25.
  const saturday = eveningReminderSlots("20261024");
  assert.deepEqual(
    saturday.map((slot) => [slot.flag, slot.dateId, slot.onlyIfDisabled]),
    [
      ["reminderSentJ2", "20261026", undefined],
      ["reminderSentJ7", "20261031", undefined],
      ["reminderSentDay", "20261025", undefined],
    ],
  );
  // Dimanche : J-2 (mardi) et J-7 couverts par le récap, sauf pour qui l'a coupé.
  const sunday = eveningReminderSlots("20261025");
  assert.equal(sunday[0]!.dateId, "20261027");
  assert.equal(sunday[0]!.onlyIfDisabled, "weeklyDigest");
  assert.equal(sunday[1]!.onlyIfDisabled, "weeklyDigest");
  assert.equal(sunday[2]!.onlyIfDisabled, undefined);

  const j7 = saturday[1]!;
  assert.equal(j7.includeEvent({ importantReminder: true }), true);
  assert.equal(j7.includeEvent({}), false);
  const eve = saturday[2]!;
  assert.equal(eve.includeEvent({ startTime: "09:00" }), true);
  assert.equal(eve.includeEvent({ startTime: "18:00" }), false);
  const morning = morningReminderSlots("20261024")[0]!;
  assert.equal(morning.dateId, "20261024");
  assert.equal(morning.includeEvent({ startTime: "18:00" }), true);
  assert.equal(morning.includeEvent({ startTime: "09:00" }), false);
});

const audience: EventAudienceEntry[] = [
  { uid: "u-yes", relation: "self", memberId: "m1", rsvp: "yes" },
  { uid: "u-none", relation: "self", memberId: "m2", rsvp: "none" },
  { uid: "u-no", relation: "self", memberId: "m3", rsvp: "no" },
  { uid: "p-none", relation: "guardian", memberId: "m2", childFirstName: "Léo", rsvp: "none" },
  { uid: "coach", relation: "coach", rsvp: "none" },
];

const audienceWithMaybe: EventAudienceEntry[] = [
  ...audience,
  { uid: "u-maybe", relation: "self", memberId: "m4", rsvp: "maybe" },
  {
    uid: "p-maybe",
    relation: "guardian",
    memberId: "m4",
    childFirstName: "Mia",
    rsvp: "maybe",
  },
];

test("ciblage : J-2 aux sans-réponse / peut-être + bilan coach, jour J sauf les non", () => {
  const eventData = { title: "U15", type: "training", dateId: "20261026", startTime: "18:00" };
  const [j2, , eve] = eveningReminderSlots("20261024");
  const j2Targets = audienceWithMaybe.filter(
    (entry) => j2!.copyFor(eventData, entry, audienceWithMaybe) != null,
  );
  assert.deepEqual(j2Targets.map((entry) => entry.uid), [
    "u-none",
    "p-none",
    "coach",
    "u-maybe",
    "p-maybe",
  ]);
  assert.match(j2!.copyFor(eventData, audienceWithMaybe[3]!, audienceWithMaybe)!.title, /^Léo · /);
  assert.match(
    j2!.copyFor(eventData, audienceWithMaybe[6]!, audienceWithMaybe)!.body,
    /peut-être/,
  );
  const coachCopy = j2!.copyFor(eventData, audienceWithMaybe[4]!, audienceWithMaybe)!;
  assert.match(coachCopy.body, /Dans 2 jours/);
  assert.match(coachCopy.body, /1 oui/);
  assert.match(coachCopy.body, /1 peut-être/);
  assert.match(coachCopy.body, /1 sans réponse/);

  const dayTargets = audience.filter(
    (entry) => eve!.copyFor(eventData, entry, audience) != null,
  );
  assert.deepEqual(dayTargets.map((entry) => entry.uid), ["u-yes", "u-none", "p-none", "coach"]);
  // Un coach n'est pas relancé pour répondre.
  assert.doesNotMatch(eve!.copyFor(eventData, audience[4]!, audience)!.body, /répondre/);
});

test("listAddedTeamMemberIds : seulement les ids nouvellement présents", () => {
  assert.deepEqual(
    listAddedTeamMemberIds(
      { teamMemberIds: ["a", "b"] },
      { teamMemberIds: ["a", "b", "c"] },
    ),
    ["c"],
  );
  assert.deepEqual(
    listAddedTeamMemberIds({ teamMemberIds: ["a"] }, { teamMemberIds: ["a"] }),
    [],
  );
  assert.deepEqual(listAddedTeamMemberIds(undefined, { teamMemberIds: ["a"] }), []);
});

test("copies peut-être J-7 / J-2 et bilan coach", () => {
  const maybe = eventReminderJ2MaybeCopy(training);
  assert.match(maybe.body, /peut-être/);
  const maybeParent = eventReminderJ2MaybeCopy({ ...training, childFirstName: "Mia" });
  assert.match(maybeParent.body, /Mia/);
  assert.match(eventReminderJ7MaybeCopy(training).body, /Dans une semaine/);
  const coach = eventCoachJ2SummaryCopy({
    ...training,
    tally: { yes: 8, no: 1, maybe: 2, none: 5 },
  });
  assert.equal(coach.title, "Entraînement jeu. 23/10 à 18h00");
  assert.match(coach.body, /8 oui/);
  assert.match(coach.body, /5 sans réponse/);
});

test("récap : agrège par personne, ignore les non, un parent voit l'enfant", () => {
  const digests = new Map<string, DigestRecipient>();
  addEventToDigests({
    digests,
    clubId: "c1",
    eventData: { type: "training", dateId: "20261027" },
    entries: audience,
  });
  addEventToDigests({
    digests,
    clubId: "c2",
    eventData: { type: "match", dateId: "20261031" },
    entries: [{ uid: "u-yes", relation: "self", memberId: "x", rsvp: "none" }],
  });
  assert.equal(digests.has("u-no"), false);
  assert.equal(digests.get("u-yes")!.items.length, 2);
  assert.deepEqual([...digests.get("u-yes")!.clubIds], ["c1", "c2"]);
  assert.equal(digests.get("p-none")!.items[0]!.awaitingResponse, true);
  assert.equal(digests.get("coach")!.items[0]!.awaitingResponse, false);
});

test("tallyRsvp : une voix par joueur convoqué", () => {
  assert.deepEqual(tallyRsvp(audience), { yes: 1, no: 1, maybe: 0, none: 1 });
});

test("isEventPostponedChange / champs modifiés / bookkeeping", () => {
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
  assert.deepEqual(
    listModifiedEventFields(
      { location: "Gym", meetingTime: "17:00", importantReminder: false },
      { location: "Salle B", meetingTime: "17:30", importantReminder: true },
    ),
    ["location", "meetingTime"],
  );
  assert.deepEqual(
    listModifiedEventFields(
      { meetingLocation: "Parking A", meetingTime: "17:00" },
      { meetingLocation: "Parking B", meetingTime: "17:00" },
    ),
    ["meetingLocation"],
  );
  assert.deepEqual(
    describeChanges(
      { location: "Salle B", meetingTime: "17:30", meetingLocation: "Parking B" },
      ["location", "meetingTime", "meetingLocation", "inconnu"],
    ),
    [
      { field: "location", value: "Salle B" },
      { field: "meetingTime", value: "17h30" },
      { field: "meetingLocation", value: "Parking B" },
    ],
  );
  assert.equal(
    isOnlyPushBookkeepingChange(
      { title: "A", reminderSentJ7: true },
      { title: "A", reminderSentJ7: false, reminderSentJ2: true, reminderSentDay: true },
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
        modifiedNotifyDueAt: { toMillis: () => 2 },
        modifiedNotifyPending: { fields: ["location"] },
      },
    ),
    true,
  );
  assert.equal(
    isOnlyPushBookkeepingChange(
      { title: "A", rsvp: { u1: "yes" } },
      { title: "A", rsvp: { u1: "yes" }, seenAt: { u2: { toMillis: () => 3 } } },
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

test("prefs : défauts, compat legacy, filtres et rate limit", () => {
  assert.deepEqual(parseNotificationPreferences(undefined), {
    events: true,
    announcements: true,
    fees: true,
    rsvp: true,
    chat: true,
    weeklyDigest: true,
    rsvpTeammates: false,
  });
  assert.equal(parseNotificationPreferences({ events: false }).events, false);
  assert.equal(parseNotificationPreferences({ events: false }).rsvp, false);
  assert.equal(parseNotificationPreferences({ rsvp: false }).rsvp, false);
  assert.equal(parseNotificationPreferences({ rsvpTeammates: true }).rsvpTeammates, true);

  const prefs = (overrides: Partial<typeof DEFAULT_NOTIFICATION_PREFERENCES>) => ({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...overrides,
  });
  const uidPrefs = new Map([
    ["a", prefs({})],
    ["b", prefs({ events: false })],
    ["d", prefs({ weeklyDigest: false, rsvpTeammates: true })],
  ]);
  const uids = ["a", "b", "c", "d"];
  assert.deepEqual(filterUidsByPreference({ uidPrefs, uids, key: "events" }), ["a", "c", "d"]);
  // Coéquipiers : opt-in explicite (absent = non).
  assert.deepEqual(
    filterUidsByPreference({ uidPrefs, uids, key: "rsvp", alsoRequire: "rsvpTeammates" }),
    ["d"],
  );
  // Relance du dimanche : seulement ceux qui ont coupé le récap.
  assert.deepEqual(
    filterUidsByPreference({ uidPrefs, uids, key: "events", onlyIfDisabled: "weeklyDigest" }),
    ["d"],
  );

  assert.equal(
    canSendManualPush({ lastManualPushAtMs: null, nowMs: 1000, cooldownMs: MANUAL_PUSH_COOLDOWN_MS }),
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

test("pushGrouping : tag par entité (et par enfant), thread sans tag pour le chat", () => {
  assert.deepEqual(
    pushGrouping({ type: "event_modified", eventId: "e1" }),
    { tag: "event_e1", threadId: "event_e1" },
  );
  // Deux enfants convoqués : deux notifs distinctes dans le même fil.
  assert.deepEqual(
    pushGrouping({ type: "event_reminder_j2", eventId: "e1", forMemberId: "m2" }),
    { tag: "event_e1_m2", threadId: "event_e1" },
  );
  assert.deepEqual(
    pushGrouping({ type: "event_rsvp_changed", eventId: "e1", memberId: "m1" }),
    { tag: "rsvp_e1", threadId: "event_e1" },
  );
  assert.deepEqual(
    pushGrouping({ type: "event_weekly_digest" }),
    { tag: "weekly_digest", threadId: "weekly_digest" },
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

test("androidChannelId : chaque clé de préférence a un canal connu de l'app", () => {
  const appChannels = new Set([
    "viro_events",
    "viro_announcements",
    "viro_chat",
    "viro_fees",
    "viro_rsvp",
  ]);
  for (const key of Object.keys(ANDROID_CHANNEL_IDS) as Array<keyof typeof ANDROID_CHANNEL_IDS>) {
    assert.ok(appChannels.has(androidChannelId(key)), key);
  }
  assert.equal(androidChannelId("weeklyDigest"), "viro_events");
});
