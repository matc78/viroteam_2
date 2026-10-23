import test from "node:test";
import assert from "node:assert/strict";
import { planConvocationChange } from "./eventConvocationsUtils";

test("planConvocationChange retire toutes les variantes et leurs réponses", () => {
  const plan = planConvocationChange({
    eventData: {
      teamMemberIds: ["mem-a", "uid-a", "mem-b"],
      rsvp: { "uid-a": "yes", "mem-b": "no" },
      seenAt: { "mem-a": 1 },
    },
    exclude: [{ id: "mem-a", aliases: ["mem-a", "uid-a"] }],
    reintegrate: [],
    isPrimary: true,
  });
  assert.deepEqual(plan.teamMemberIds, ["mem-b"]);
  assert.deepEqual(plan.excludedMemberIds, ["mem-a"]);
  assert.deepEqual(plan.deletedMapPaths.sort(), ["rsvp.uid-a", "seenAt.mem-a"]);
  assert.equal(plan.changed, true);
});

test("planConvocationChange réintègre un exclu", () => {
  const plan = planConvocationChange({
    eventData: { teamMemberIds: ["mem-b"], excludedMemberIds: ["mem-a"] },
    exclude: [],
    reintegrate: [{ id: "mem-a", aliases: ["mem-a", "uid-a"] }],
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
    reintegrate: [{ id: "mem-a", aliases: ["mem-a"] }],
    isPrimary: false,
  });
  assert.deepEqual(plan.teamMemberIds, ["mem-b"]);
  assert.equal(plan.changed, false);
});

test("planConvocationChange : event ouvert, réintégration même sans exclusion", () => {
  const plan = planConvocationChange({
    eventData: { teamMemberIds: ["mem-b"] },
    exclude: [],
    reintegrate: [{ id: "mem-a", aliases: ["mem-a"] }],
    isPrimary: true,
  });
  assert.deepEqual(plan.teamMemberIds.sort(), ["mem-a", "mem-b"]);
  assert.equal(plan.changed, true);
});

test("planConvocationChange idempotent sur un retrait déjà fait", () => {
  const plan = planConvocationChange({
    eventData: { teamMemberIds: ["mem-b"], excludedMemberIds: ["mem-a"] },
    exclude: [{ id: "mem-a", aliases: ["mem-a"] }],
    reintegrate: [],
    isPrimary: true,
  });
  assert.equal(plan.changed, false);
});
