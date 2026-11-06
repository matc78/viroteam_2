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
  eventManualPushSentCopy,
  eventModifiedCopy,
  eventPostponedCopy,
  eventCoachSummaryCopy,
  eventReminderJ2Copy,
  eventReminderJ2MaybeCopy,
  eventReminderJ7Copy,
  eventReminderJ7MaybeCopy,
  eventRsvpChangedCopy,
  eventTypePushLabel,
  feeReminderCopy,
  formatMemberShortName,
  formatRsvpTally,
  isRsvpPresenceFlip,
  CREATED_MATCH_ONLY_TITLE,
  CREATED_PLAYER_TITLES,
  J2_NONE_BODY_ACTION,
  J2_NONE_TITLES,
  MANUAL_PLAYER_TITLES,
  pickRandom,
  preferenceOffWarning,
  rsvpStatusLabel,
  teammateRsvpDigestCopy,
  truncatePushBody,
  weeklyDigestCopy,
  type EventPushContext,
} from "./notifications/copy";

/** Tirage déterministe : toujours le 1er élément de la pool. */
const firstPick = () => 0;
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
  latestStatusByEvent,
  memberPlanningDeepLink,
  parisDateId,
  planningDeepLink,
  planningWebPath,
  RSVP_HIGHLIGHT_MAX,
  withRsvpHighlights,
} from "./notifications/deepLinks";
import {
  creationReminderFlags,
  dayOfReminderIsEve,
  describeChanges,
  isConvocationReintegration,
  isEventContentModified,
  eventScheduleChange,
  isEventPostponedChange,
  isOnlyPushBookkeepingChange,
  listAddedTeamMemberIds,
  listModifiedEventFields,
  listRsvpStatusChanges,
} from "./notifications/eventChange";
import { eventModifiedDebounceMs } from "./notifications/eventModifiedNotify";
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
  TEAMMATE_RSVP_DIGEST_MS,
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

test("rappels J-7 / J-2 : titres vestiaire, équipe dans le corps", () => {
  const j7 = eventReminderJ7Copy(
    { ...training, type: "tournament", title: "Tournoi de Noël" },
    { random: firstPick },
  );
  assert.equal(j7.title, "Tournoi jeu. 23/10");
  assert.match(
    j7.body,
    /^Dans une semaine · Tournoi de Noël · Gymnase Jean Moulin\. Tu viens \? Le coach/,
  );

  const j2 = eventReminderJ2Copy(training, { random: firstPick });
  assert.equal(j2.title, J2_NONE_TITLES[0]);
  assert.equal(j2.body, `U15 · 18h00. ${J2_NONE_BODY_ACTION}`);
  assert.notEqual(j2.body, j7.body);

  // Parent : prénom + type dans le titre (jour / équipe dans le corps), ton soft.
  const j2Parent = eventReminderJ2Copy(forLeo, { random: firstPick });
  assert.equal(j2Parent.title, "Léo · Entraînement");
  assert.match(j2Parent.body, /pour Léo/);
  assert.match(j2Parent.body, /^U15 · 18h00/);
  assert.match(eventReminderJ7Copy(forLeo, { random: firstPick }).body, /Léo vient \?/);

  // Titre libre identique au type : pas de répétition dans le corps.
  assert.equal(
    eventReminderJ2Copy({ ...training, title: "Entraînement" }, { random: firstPick }).title,
    J2_NONE_TITLES[0],
  );
  assert.equal(
    eventReminderJ2Copy({ ...training, title: "Entraînement" }, { random: firstPick }).body,
    `18h00. ${J2_NONE_BODY_ACTION}`,
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
  assert.equal(today.title, "Aujourd’hui · Match");
  assert.equal(today.body, "U15 · 15h00 · RDV 14h15 · Gymnase Jean Moulin");

  const tomorrow = eventDayOfReminderCopy(
    { ...training, when: "tomorrow", rsvp: "none" },
    { random: firstPick },
  );
  assert.equal(tomorrow.title, "Demain · Entraînement");
  assert.match(tomorrow.body, /^U15 · 18h00 · /);
  assert.match(tomorrow.body, /Hésite surtout pas à faire un choix\.$/);

  const parent = eventDayOfReminderCopy(
    { ...forLeo, when: "today", rsvp: "none" },
    { random: firstPick },
  );
  // « Aujourd’hui · Léo · Entraînement » dépasse ~26 car. → fallback.
  assert.equal(parent.title, "Léo · Entraînement");
  assert.match(parent.body, /Hésite surtout pas à faire un choix pour Léo\.$/);
});

test("création, annulation, report, modification, push coach", () => {
  const created = eventCreatedCopy(
    { ...training, type: "match", dayLabel: "sam. 25/10" },
    { random: firstPick },
  );
  assert.equal(created.title, CREATED_PLAYER_TITLES[0]);
  assert.equal(
    created.body,
    "Match sam. 25/10 · U15 · 18h00 · Gymnase Jean Moulin. Tu viens ?",
  );
  assert.equal(eventCreatedCopy(forLeo, { random: firstPick }).title, "Convocation · Léo");
  // Dernier index de la pool match = titre réservé aux matchs.
  const matchLast = eventCreatedCopy(
    { ...training, type: "match", dayLabel: "sam. 25/10" },
    { random: () => 0.999 },
  );
  assert.equal(matchLast.title, CREATED_MATCH_ONLY_TITLE);
  assert.match(matchLast.body, /Confirme vite\.$/);
  assert.equal(
    eventCreatedCopy(training, { random: () => 0.999 }).title,
    CREATED_PLAYER_TITLES[CREATED_PLAYER_TITLES.length - 1],
  );
  assert.doesNotMatch(
    eventCreatedCopy(training, { random: () => 0.999 }).body,
    /Confirme vite/,
  );

  const canceled = eventCanceledCopy(training);
  assert.equal(canceled.title, "Annulé · Entraînement");
  assert.equal(canceled.body, "U15 · jeu. 23/10 — L’entraînement de 18h00 n’aura pas lieu.");
  assert.equal(
    eventCanceledCopy({ ...training, type: "meeting", title: "", startTime: undefined }).body,
    "jeu. 23/10 — La réunion n’aura pas lieu.",
  );

  const postponedDate = eventPostponedCopy({
    ...training,
    dayLabel: "lun. 27/10",
    dateChanged: true,
    timeChanged: false,
    previousDayLabel: "jeu. 23/10",
  });
  assert.equal(postponedDate.title, "Report · Entraînement");
  assert.equal(
    postponedDate.body,
    "U15 · Reporté au lun. 27/10 à 18h00 (au lieu de jeu. 23/10). Vérifie ta dispo.",
  );

  const postponedTime = eventPostponedCopy({
    ...training,
    startTime: "19h00",
    dateChanged: false,
    timeChanged: true,
    previousStartTime: "18h00",
  });
  assert.equal(
    postponedTime.body,
    "U15 · jeu. 23/10 — passe à 19h00 (au lieu de 18h00). Vérifie ta dispo.",
  );

  const postponedBoth = eventPostponedCopy({
    ...training,
    type: "match",
    dayLabel: "dim. 08/11",
    startTime: "16h00",
    dateChanged: true,
    timeChanged: true,
    previousDayLabel: "dim. 01/11",
    previousStartTime: "14h30",
  });
  assert.equal(postponedBoth.title, "Report · Match");
  assert.equal(
    postponedBoth.body,
    "U15 · Reporté au dim. 08/11 à 16h00 (au lieu de dim. 01/11 à 14h30). Vérifie ta dispo.",
  );

  assert.match(
    eventPostponedCopy({
      ...forLeo,
      dateChanged: false,
      timeChanged: true,
      previousStartTime: "18h00",
      startTime: "19h00",
    }).body,
    /Vérifie la dispo de Léo\.$/,
  );
  assert.equal(
    eventPostponedCopy({
      ...forLeo,
      dateChanged: true,
      timeChanged: false,
      previousDayLabel: "jeu. 23/10",
      dayLabel: "lun. 27/10",
    }).title,
    "Léo · Report",
  );

  const modified = eventModifiedCopy({
    ...training,
    changes: [
      { field: "location", value: "Salle B" },
      { field: "meetingTime", value: "17h30" },
    ],
  });
  assert.equal(modified.title, "Entraînement modifié");
  assert.equal(
    modified.body,
    "U15 · Entraînement jeu. 23/10 · Nouveau lieu : Salle B · RDV à 17h30.",
  );

  const manual = eventManualPushCopy(
    { ...training, rsvp: "none", coachFirstName: "Marc" },
    { random: firstPick },
  );
  assert.equal(manual.title, MANUAL_PLAYER_TITLES[0]);
  assert.equal(
    manual.body,
    "Signé coach Marc · Entraînement jeu. 23/10 · U15 · 18h00 · Gymnase Jean Moulin",
  );
  const manualParent = eventManualPushCopy(
    { ...forLeo, rsvp: "maybe", coachFirstName: "Marc" },
    { random: firstPick },
  );
  assert.equal(manualParent.title, "Réponds pour Léo");
  assert.doesNotMatch(manualParent.title, /Batard|neuille/i);
  assert.equal(eventManualPushSentCopy(training).title, "Notif envoyée");
});

test("pickRandom et pools manuelles exposées", () => {
  assert.equal(pickRandom(["a", "b", "c"], () => 0), "a");
  assert.equal(pickRandom(["a", "b", "c"], () => 0.99), "c");
  assert.ok(MANUAL_PLAYER_TITLES.includes("Réponds Batard !!"));
  assert.ok(MANUAL_PLAYER_TITLES.includes("Réponds, tête de neuille"));
});

test("RSVP : digest staff avec décompte, confirmation parent", () => {
  const tally = { yes: 12, no: 3, maybe: 0, none: 4 };
  assert.equal(formatRsvpTally(tally), "12 oui, 3 non, 4 sans réponse");

  const single = eventRsvpChangedCopy(
    {
      responses: [{ memberName: "Marie D.", status: "yes" }],
      ctx: training,
      tally,
    },
    { random: firstPick },
  );
  assert.equal(single.title, "Marie D. vient");
  assert.equal(single.body, "Entraînement jeu. 23/10 · U15 · 12 oui, 3 non, 4 sans réponse");

  const flip = eventRsvpChangedCopy(
    {
      responses: [
        { memberName: "Marie D.", status: "no", previousStatus: "yes" },
      ],
      ctx: training,
      tally,
    },
    { random: firstPick },
  );
  assert.equal(isRsvpPresenceFlip("yes", "no"), true);
  assert.equal(flip.title, "Marie D. a basculé");
  assert.match(flip.body, /ne vient plus/i);

  const digest = eventRsvpChangedCopy(
    {
      responses: [
        { memberName: "Marie D.", status: "yes" },
        { memberName: "Paul G.", status: "no" },
        { memberName: "Zoé R.", status: "maybe" },
      ],
      ctx: forLeo,
      tally,
    },
    { random: firstPick },
  );
  // Le digest staff ne prend jamais le prénom d'un enfant dans le titre.
  assert.equal(digest.title, "3 nouvelles réponses");
  assert.equal(digest.body, "Entraînement jeu. 23/10 · U15 · 12 oui, 3 non, 4 sans réponse");

  const teammateMulti = teammateRsvpDigestCopy(
    {
      items: [
        {
          responderMemberId: "m1",
          responderName: "Marie D.",
          eventId: "e1",
          status: "yes",
        },
        {
          responderMemberId: "m1",
          responderName: "Marie D.",
          eventId: "e2",
          status: "no",
        },
        {
          responderMemberId: "m1",
          responderName: "Marie D.",
          eventId: "e3",
          status: "maybe",
        },
      ],
    },
    { random: firstPick },
  );
  assert.equal(teammateMulti.title, "Marie D. · 3 réponses");
  assert.match(teammateMulti.body, /Marie D\. a répondu à 3 convocations/);
  assert.match(teammateMulti.body, /Jette un œil|Check le planning/);
  assert.equal(TEAMMATE_RSVP_DIGEST_MS, 2 * 60 * 1000);

  assert.equal(childRsvpConfirmationCopy({ ctx: forLeo, status: "no" }).title, "Léo · Entraînement");
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
  const copy = weeklyDigestCopy(
    [
      { type: "training", dayLabel: "lun. 27/10", awaitingResponse: false },
      { type: "training", dayLabel: "mer. 29/10", awaitingResponse: true },
      { type: "match", dayLabel: "sam. 1/11", awaitingResponse: true },
    ],
    { random: firstPick },
  );
  assert.equal(copy?.title, "Ta semaine");
  assert.equal(
    copy?.body,
    "1 match, 2 entraînements. 2 réponses attendues (mer. 29/10, sam. 1/11). Hésite pas à checker.",
  );
  assert.equal(
    weeklyDigestCopy(
      [{ type: "meeting", dayLabel: "jeu. 30/10", awaitingResponse: false }],
      { random: firstPick },
    )?.body,
    "1 réunion. Tout est répondu, bonne semaine !",
  );
});

test("annonce et cotisation : titres courts, club dans le corps", () => {
  assert.equal(
    announcementPublishedCopy({ clubName: "VB Lyon", message: "Hello" }).title,
    "Nouvelle annonce",
  );
  assert.equal(
    announcementPublishedCopy({ clubName: "VB Lyon", message: "Hello" }).body,
    "VB Lyon · Hello",
  );
  const fee = feeReminderCopy({
    clubName: "VB Lyon",
    seasonLabel: "2026-2027",
    deadlineLabel: "30/11",
    overdue: false,
  });
  assert.equal(fee.title, "Cotisation à régler");
  assert.equal(fee.body, "VB Lyon · Saison 2026-2027 · À régler avant le 30/11.");
  assert.equal(
    feeReminderCopy({ clubName: "", seasonLabel: "", overdue: false }).body,
    "Pense à régler ta cotisation.",
  );
  assert.equal(
    feeReminderCopy({
      clubName: "X",
      seasonLabel: "S",
      deadlineLabel: "15/10",
      overdue: true,
    }).title,
    "Cotisation en retard",
  );
  assert.match(
    feeReminderCopy({ clubName: "X", seasonLabel: "S", deadlineLabel: "15/10", overdue: true }).body,
    /Date limite dépassée \(15\/10\)/,
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

test("deep links RSVP : events à encadrer sur la home", () => {
  assert.equal(
    withRsvpHighlights(memberPlanningDeepLink(), "c 1", [
      { eventId: "e1", status: "yes" },
      { eventId: "e2", status: "no" },
    ]),
    "viroteam://planning?rsvpClubId=c%201&rsvpHighlights=e1%3Ayes%2Ce2%3Ano",
  );
  assert.equal(
    withRsvpHighlights(planningDeepLink("c1", "20260908", { eventId: "e1" }), "c1", [
      { eventId: "e1", status: "maybe" },
    ]),
    "viroteam://planning?clubId=c1&date=2026-09-08&eventId=e1" +
      "&rsvpClubId=c1&rsvpHighlights=e1%3Amaybe",
  );
  // Retour à « sans réponse » : rien à encadrer, lien inchangé.
  assert.equal(
    withRsvpHighlights(memberPlanningDeepLink(), "c1", [
      { eventId: "e1", status: "none" },
    ]),
    "viroteam://planning",
  );
  const many = Array.from({ length: RSVP_HIGHLIGHT_MAX + 3 }, (_, index) => ({
    eventId: `e${index}`,
    status: "yes",
  }));
  const capped = new URL(withRsvpHighlights("viroteam://planning", "c1", many));
  assert.equal(
    capped.searchParams.get("rsvpHighlights")!.split(",").length,
    RSVP_HIGHLIGHT_MAX,
  );

  assert.deepEqual(
    latestStatusByEvent([
      { eventId: "e1", status: "yes", atMs: 10 },
      { eventId: "e2", status: "maybe", atMs: 5 },
      { eventId: "e1", status: "no", atMs: 20 },
      { eventId: "e2", status: "yes", atMs: 1 },
    ]),
    [
      { eventId: "e1", status: "no" },
      { eventId: "e2", status: "maybe" },
    ],
  );
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
      ["reminderSentCoachEve", "20261025", undefined],
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
  // Bilan coach de la veille : les events matinaux l'ont dans le rappel de la veille.
  const coachEve = saturday[3]!;
  assert.equal(coachEve.includeEvent({ startTime: "18:00" }), true);
  assert.equal(coachEve.includeEvent({ startTime: "09:00" }), false);
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
    (entry) => j2!.copyFor(eventData, entry, audienceWithMaybe, "j2") != null,
  );
  assert.deepEqual(j2Targets.map((entry) => entry.uid), [
    "u-none",
    "p-none",
    "coach",
    "u-maybe",
    "p-maybe",
  ]);
  assert.match(
    j2!.copyFor(eventData, audienceWithMaybe[3]!, audienceWithMaybe, "eve")!.title,
    /^Léo · /,
  );
  assert.match(
    j2!.copyFor(eventData, audienceWithMaybe[6]!, audienceWithMaybe, "eve")!.body,
    /peut-être/,
  );
  // Bilan J-2 seulement pour les coachs qui l'ont choisi.
  assert.equal(j2!.copyFor(eventData, audienceWithMaybe[4]!, audienceWithMaybe, "eve"), null);
  assert.equal(j2!.copyFor(eventData, audienceWithMaybe[4]!, audienceWithMaybe, "day"), null);
  const coachCopy = j2!.copyFor(eventData, audienceWithMaybe[4]!, audienceWithMaybe, "j2")!;
  assert.match(coachCopy.body, /Dans 2 jours/);
  assert.match(coachCopy.body, /1 oui/);
  assert.match(coachCopy.body, /1 peut-être/);
  assert.match(coachCopy.body, /1 sans réponse/);

  const dayTargets = audience.filter(
    (entry) => eve!.copyFor(eventData, entry, audience, "j2") != null,
  );
  assert.deepEqual(dayTargets.map((entry) => entry.uid), ["u-yes", "u-none", "p-none", "coach"]);
  // Un coach n'est pas relancé pour répondre.
  assert.doesNotMatch(eve!.copyFor(eventData, audience[4]!, audience, "j2")!.body, /répondre/);
});

test("bilan coach selon son réglage : J-2, veille ou jour J", () => {
  const coach = audience[4]!;
  const evening = { title: "U15", type: "training", dateId: "20261025", startTime: "18:00" };
  const early = { ...evening, startTime: "09:00" };
  const [, , dayEve, coachEve] = eveningReminderSlots("20261024");
  const morning = morningReminderSlots("20261025")[0]!;

  // Veille : push dédiée pour un event de 10h et plus, rien pour les autres réglages.
  assert.equal(
    coachEve!.copyFor(evening, coach, audience, "eve")!.body,
    "Demain · 18h00 · 1 oui, 1 non, 1 sans réponse",
  );
  assert.equal(coachEve!.copyFor(evening, coach, audience, "day"), null);
  assert.equal(coachEve!.copyFor(evening, coach, audience, "j2"), null);
  assert.equal(coachEve!.copyFor(evening, audience[1]!, audience, "eve"), null);
  // Event matinal : le décompte arrive avec le rappel de la veille (veille ou jour J).
  assert.match(dayEve!.copyFor(early, coach, audience, "eve")!.body, /^1 oui, 1 non/);
  assert.match(dayEve!.copyFor(early, coach, audience, "day")!.body, /^1 oui, 1 non/);
  assert.doesNotMatch(dayEve!.copyFor(early, coach, audience, "j2")!.body, /oui/);
  // Jour J le matin : décompte seulement pour le réglage « jour J ».
  assert.match(morning.copyFor(evening, coach, audience, "day")!.body, /^1 oui, 1 non/);
  assert.doesNotMatch(morning.copyFor(evening, coach, audience, "eve")!.body, /oui/);
  // Un joueur n'a jamais le décompte.
  assert.doesNotMatch(morning.copyFor(evening, audience[0]!, audience, "day")!.body, /1 oui/);
});

test("regroupement « modifié » : 10 min, 2 min le jour J", () => {
  const now = new Date("2026-10-24T10:00:00Z");
  assert.equal(eventModifiedDebounceMs({ eventDateId: "20261024", now }), 2 * 60 * 1000);
  assert.equal(eventModifiedDebounceMs({ eventDateId: "", now }), 2 * 60 * 1000);
  assert.equal(eventModifiedDebounceMs({ eventDateId: "20261025", now }), 10 * 60 * 1000);
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

test("isConvocationReintegration : un exclu quitte excludedMemberIds", () => {
  assert.equal(
    isConvocationReintegration(
      { excludedMemberIds: ["a", "b"] },
      { excludedMemberIds: ["b"] },
    ),
    true,
  );
  assert.equal(
    isConvocationReintegration(
      { excludedMemberIds: ["a"] },
      { excludedMemberIds: ["a", "b"] },
    ),
    false,
  );
  assert.equal(isConvocationReintegration({}, { teamMemberIds: ["a"] }), false);
  assert.equal(isConvocationReintegration(undefined, {}), false);
});

test("copies peut-être J-7 / J-2 et bilan coach", () => {
  const maybe = eventReminderJ2MaybeCopy(training, { random: firstPick });
  assert.match(maybe.body, /peut-être|fige|flou/);
  const maybeParent = eventReminderJ2MaybeCopy(
    { ...training, childFirstName: "Mia" },
    { random: firstPick },
  );
  assert.match(maybeParent.body, /Mia/);
  assert.match(
    eventReminderJ7MaybeCopy(training, { random: firstPick }).body,
    /Dans une semaine/,
  );
  const coach = eventCoachSummaryCopy(
    {
      ...training,
      tally: { yes: 8, no: 1, maybe: 2, none: 5 },
      when: "j2",
    },
    { random: firstPick },
  );
  assert.equal(coach.title, "Entraînement jeu. 23/10");
  assert.match(coach.body, /^Dans 2 jours · 18h00 · 8 oui/);
  assert.match(coach.body, /5 sans réponse/);
  const coachEve = eventCoachSummaryCopy(
    {
      ...training,
      tally: { yes: 8, no: 1, maybe: 0, none: 0 },
      when: "eve",
    },
    { random: firstPick },
  );
  assert.equal(coachEve.body, "Demain · 18h00 · 8 oui, 1 non");
  const dayWithTally = eventDayOfReminderCopy({
    ...training,
    when: "today",
    rsvp: "yes",
    tally: { yes: 8, no: 1, maybe: 0, none: 2 },
  });
  assert.match(dayWithTally.body, /^8 oui, 1 non, 2 sans réponse · /);
  assert.doesNotMatch(dayWithTally.body, /répondre|choix/);
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

test("fiche non liée (uid null) : comptée au décompte, absente des récaps", () => {
  const withUnlinked: EventAudienceEntry[] = [
    ...audience,
    { uid: null, relation: "self", memberId: "m-kid", rsvp: "yes" },
    { uid: "p-kid", relation: "guardian", memberId: "m-kid", rsvp: "yes" },
  ];
  assert.deepEqual(tallyRsvp(withUnlinked), { yes: 2, no: 1, maybe: 0, none: 1 });
  const digests = new Map<string, DigestRecipient>();
  addEventToDigests({
    digests,
    clubId: "c1",
    eventData: { type: "training", dateId: "20261027" },
    entries: withUnlinked,
  });
  assert.equal(digests.has("m-kid"), false);
  assert.equal(digests.get("p-kid")!.items.length, 1);
});

test("isEventPostponedChange / champs modifiés / bookkeeping", () => {
  assert.equal(
    isEventPostponedChange(
      { dateId: "20260908", startTime: "18:00" },
      { dateId: "20260909", startTime: "18:00" },
    ),
    true,
  );
  assert.deepEqual(
    eventScheduleChange(
      { dateId: "20260908", startTime: "18:00" },
      { dateId: "20260909", startTime: "18:00" },
    ),
    { dateChanged: true, timeChanged: false },
  );
  assert.deepEqual(
    eventScheduleChange(
      { dateId: "20260908", startTime: "14:30" },
      { dateId: "20260908", startTime: "16:00" },
    ),
    { dateChanged: false, timeChanged: true },
  );
  assert.deepEqual(
    eventScheduleChange(
      { dateId: "20260908", startTime: "14:30" },
      { dateId: "20260909", startTime: "16:00" },
    ),
    { dateChanged: true, timeChanged: true },
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
    isOnlyPushBookkeepingChange({ title: "A" }, { title: "A", reminderSentCoachEve: true }),
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
    [{ memberId: "a", status: "maybe", previousStatus: "yes" }],
  );
  assert.deepEqual(
    listRsvpStatusChanges({ rsvp: {} }, { rsvp: { a: "yes" } }),
    [{ memberId: "a", status: "yes", previousStatus: "none" }],
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
    coachSummaryTiming: "eve",
  });
  assert.equal(
    parseNotificationPreferences({ coachSummaryTiming: "day" }).coachSummaryTiming,
    "day",
  );
  assert.equal(
    parseNotificationPreferences({ coachSummaryTiming: "j-1" }).coachSummaryTiming,
    "eve",
  );
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
    pushGrouping({
      type: "event_rsvp_changed",
      teammateDigest: "1",
      clubId: "c1",
    }),
    { tag: "teammate_rsvp_c1", threadId: "teammate_rsvp_c1" },
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
