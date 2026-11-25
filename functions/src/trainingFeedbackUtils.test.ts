import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTrainingFeedbackEvent,
  coachDisplayName,
  parseTrainingFeedbackInput,
  TRAINING_MESSAGE_MAX_CHARS,
  TrainingFeedbackError,
  trainingFeedbackPushCopy,
} from "./trainingFeedbackUtils";

const trainingEvent = {
  type: "training",
  teamIds: ["teamA"],
  teamMemberIds: ["p1", "p2"],
  dateId: "20261120",
};

test("parseTrainingFeedbackInput : deux notes 1–5 (demi-étoiles) obligatoires", () => {
  const input = parseTrainingFeedbackInput({ levelRating: 4, engagementRating: 5 });
  assert.equal(input.levelRating, 4);
  assert.equal(input.engagementRating, 5);
  assert.equal(input.collectiveMessage, null);
  assert.equal(input.playerMessages.size, 0);

  const half = parseTrainingFeedbackInput({
    levelRating: 3.5,
    engagementRating: 1,
  });
  assert.equal(half.levelRating, 3.5);
  assert.equal(half.engagementRating, 1);

  for (const bad of [0, 6, 0.5, 3.3, "4", null]) {
    assert.throws(
      () => parseTrainingFeedbackInput({ levelRating: bad, engagementRating: 3 }),
      TrainingFeedbackError,
    );
  }
  assert.throws(() => parseTrainingFeedbackInput({ levelRating: 3 }), TrainingFeedbackError);
});

test("parseTrainingFeedbackInput : messages nettoyés, vides ignorés, longueur bornée", () => {
  const input = parseTrainingFeedbackInput({
    levelRating: 3,
    engagementRating: 3,
    collectiveMessage: "  Bonne séance  ",
    playerMessages: { p1: " Super service ", p2: "   " },
  });
  assert.equal(input.collectiveMessage, "Bonne séance");
  assert.deepEqual([...input.playerMessages], [["p1", "Super service"]]);

  assert.throws(
    () =>
      parseTrainingFeedbackInput({
        levelRating: 3,
        engagementRating: 3,
        collectiveMessage: "x".repeat(TRAINING_MESSAGE_MAX_CHARS + 1),
      }),
    TrainingFeedbackError,
  );
  assert.throws(
    () =>
      parseTrainingFeedbackInput({
        levelRating: 3,
        engagementRating: 3,
        playerMessages: { "a/b": "Salut" },
      }),
    TrainingFeedbackError,
  );
});

test("assertTrainingFeedbackEvent : entraînement d'équipe passé, joueurs convoqués", () => {
  assert.doesNotThrow(() =>
    assertTrainingFeedbackEvent({ event: trainingEvent, todayDateId: "20261120", memberIds: ["p1"] }),
  );
  const rejects = (event: Record<string, unknown>, memberIds: string[] = []) =>
    assert.throws(
      () => assertTrainingFeedbackEvent({ event, todayDateId: "20261125", memberIds }),
      TrainingFeedbackError,
    );
  rejects({ ...trainingEvent, type: "match" });
  rejects({ ...trainingEvent, canceled: true });
  rejects({ ...trainingEvent, allTeams: true });
  rejects({ ...trainingEvent, teamIds: [] });
  rejects({ ...trainingEvent, dateId: "20261126" });
  rejects(trainingEvent, ["inconnu"]);
});

test("coachDisplayName : prénom nom, sinon nom affiché", () => {
  assert.equal(coachDisplayName({ firstName: "Léa", lastName: "Martin" }), "Léa Martin");
  assert.equal(coachDisplayName({ displayName: "Coach Léa" }), "Coach Léa");
  assert.equal(coachDisplayName(null), "");
});

test("trainingFeedbackPushCopy : joueur ou parent, avec ou sans message perso", () => {
  const self = trainingFeedbackPushCopy({ hasMessage: true, dayLabel: "mar. 25 nov." });
  assert.equal(self.title, "Ton coach t'a laissé un mot");
  assert.match(self.body, /mar\. 25 nov\./);

  const parent = trainingFeedbackPushCopy({
    hasMessage: false,
    childFirstName: "Inès",
    dayLabel: "mar. 25 nov.",
  });
  assert.equal(parent.title, "Retour de séance dispo");
  assert.match(parent.body, /Inès/);
});
