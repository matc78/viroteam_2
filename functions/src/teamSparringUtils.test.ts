import test from "node:test";
import assert from "node:assert/strict";
import { planSparringMatchChange } from "./teamSparringUtils";

test("planSparringMatchChange : un nouveau sparring quitte le match et ses réponses", () => {
  const plan = planSparringMatchChange({
    eventData: {
      type: "match",
      teamMemberIds: ["a", "b"],
      rsvp: { a: "maybe" },
      seenAt: { a: 1 },
    },
    added: ["a"],
    removed: [],
  });
  assert.ok(plan);
  assert.deepEqual(plan.teamMemberIds, ["b"]);
  assert.deepEqual(plan.excludedMemberIds, ["a"]);
  assert.deepEqual(plan.deletedMapPaths, ["rsvp.a", "seenAt.a"]);
});

test("planSparringMatchChange : un sparring déjà présent reste convoqué", () => {
  assert.equal(
    planSparringMatchChange({
      eventData: { type: "match", teamMemberIds: ["a"], rsvp: { a: "yes" } },
      added: ["a"],
      removed: [],
    }),
    null,
  );
});

test("planSparringMatchChange : le retour joueur réintègre un exclu", () => {
  const plan = planSparringMatchChange({
    eventData: { type: "match", teamMemberIds: ["b"], excludedMemberIds: ["a"] },
    added: [],
    removed: ["a"],
  });
  assert.ok(plan);
  assert.deepEqual(plan.teamMemberIds.sort(), ["a", "b"]);
  assert.deepEqual(plan.excludedMemberIds, []);
});

test("planSparringMatchChange : ignore entraînements et matchs annulés", () => {
  const base = { teamMemberIds: ["a"] };
  assert.equal(
    planSparringMatchChange({
      eventData: { ...base, type: "training" },
      added: ["a"],
      removed: [],
    }),
    null,
  );
  assert.equal(
    planSparringMatchChange({
      eventData: { ...base, type: "match", canceled: true },
      added: ["a"],
      removed: [],
    }),
    null,
  );
});

test("planSparringMatchChange : idempotent", () => {
  assert.equal(
    planSparringMatchChange({
      eventData: { type: "match", teamMemberIds: [], excludedMemberIds: ["a"] },
      added: ["a"],
      removed: [],
    }),
    null,
  );
});

test("planSparringMatchChange : un coach sparring reste convoqué", () => {
  assert.equal(
    planSparringMatchChange({
      eventData: { type: "match", teamMemberIds: ["c"] },
      added: ["c"],
      removed: [],
      coachIds: ["c"],
    }),
    null,
  );
});

test("planSparringMatchChange : un sparring qui quitte l'équipe n'est plus exclu", () => {
  const plan = planSparringMatchChange({
    eventData: { type: "match", teamMemberIds: ["b"], excludedMemberIds: ["a", "x"] },
    added: [],
    removed: [],
    released: ["a"],
  });
  assert.ok(plan);
  // Exclusion levée sans reconvocation (il n'est plus dans l'effectif).
  assert.deepEqual(plan.teamMemberIds, ["b"]);
  assert.deepEqual(plan.excludedMemberIds, ["x"]);
});
