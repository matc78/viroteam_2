import test from "node:test";
import assert from "node:assert/strict";
import { planConvocationChange } from "./eventConvocationsUtils";

test("planConvocationChange retire l'id et ses réponses", () => {
  const plan = planConvocationChange({
    eventData: {
      teamMemberIds: ["mem-a", "mem-b"],
      rsvp: { "mem-a": "yes", "mem-b": "no" },
      seenAt: { "mem-a": 1 },
    },
    exclude: ["mem-a"],
    reintegrate: [],
    isPrimary: true,
  });
  assert.deepEqual(plan.teamMemberIds, ["mem-b"]);
  assert.deepEqual(plan.excludedMemberIds, ["mem-a"]);
  assert.deepEqual(plan.deletedMapPaths.sort(), ["rsvp.mem-a", "seenAt.mem-a"]);
  assert.equal(plan.changed, true);
});

test("planConvocationChange réintègre un exclu", () => {
  const plan = planConvocationChange({
    eventData: { teamMemberIds: ["mem-b"], excludedMemberIds: ["mem-a"] },
    exclude: [],
    reintegrate: ["mem-a"],
    isPrimary: false,
  });
  assert.deepEqual(plan.teamMemberIds.sort(), ["mem-a", "mem-b"]);
  assert.deepEqual(plan.excludedMemberIds, []);
  assert.equal(plan.changed, true);
});

test("planConvocationChange : occurrence suivante non exclue = inchangée", () => {
  const plan = planConvocationChange({
    eventData: { teamMemberIds: ["mem-b"] },
    exclude: [],
    reintegrate: ["mem-a"],
    isPrimary: false,
  });
  assert.deepEqual(plan.teamMemberIds, ["mem-b"]);
  assert.equal(plan.changed, false);
});

test("planConvocationChange : event ouvert, réintégration même sans exclusion", () => {
  const plan = planConvocationChange({
    eventData: { teamMemberIds: ["mem-b"] },
    exclude: [],
    reintegrate: ["mem-a"],
    isPrimary: true,
  });
  assert.deepEqual(plan.teamMemberIds.sort(), ["mem-a", "mem-b"]);
  assert.equal(plan.changed, true);
});

test("planConvocationChange idempotent sur un retrait déjà fait", () => {
  const plan = planConvocationChange({
    eventData: { teamMemberIds: ["mem-b"], excludedMemberIds: ["mem-a"] },
    exclude: ["mem-a"],
    reintegrate: [],
    isPrimary: true,
  });
  assert.equal(plan.changed, false);
});
