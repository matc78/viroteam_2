import test from "node:test";
import assert from "node:assert/strict";
import {
  computeParentTeamIds,
  diffIds,
  isActiveChild,
  playerIdsOf,
  sameIdSet,
} from "./parentTeamsUtils";

test("computeParentTeamIds : union triée des équipes des enfants actifs", () => {
  assert.deepEqual(
    computeParentTeamIds([
      { status: "active", teamIds: ["t2", "t1"] },
      { status: "active", teamIds: ["t1", "t3"] },
    ]),
    ["t1", "t2", "t3"],
  );
});

test("computeParentTeamIds ignore les fiches archivées et les ids vides", () => {
  assert.deepEqual(
    computeParentTeamIds([
      { status: "archived", teamIds: ["t9"] },
      { status: "active", teamIds: ["", "t1"] },
      { status: "pending", teamIds: ["t4"] },
    ]),
    ["t1", "t4"],
  );
  assert.deepEqual(computeParentTeamIds([]), []);
});

test("isActiveChild : seul archived est inactif", () => {
  assert.equal(isActiveChild("active"), true);
  assert.equal(isActiveChild(undefined), true);
  assert.equal(isActiveChild("archived"), false);
});

test("diffIds calcule ajoutés / retirés", () => {
  assert.deepEqual(diffIds(["a", "b"], ["b", "c", "c"]), {
    added: ["c"],
    removed: ["a"],
  });
  assert.deepEqual(diffIds([], ["x"]), { added: ["x"], removed: [] });
  assert.deepEqual(diffIds(["x"], []), { added: [], removed: ["x"] });
  assert.deepEqual(diffIds(["x"], ["x"]), { added: [], removed: [] });
});

test("playerIdsOf lit playerIds en tolérant les valeurs non-string", () => {
  assert.deepEqual(playerIdsOf({ playerIds: ["p1", 3, "p1", null, "p2"] }), ["p1", "p2"]);
  assert.deepEqual(playerIdsOf(undefined), []);
  assert.deepEqual(playerIdsOf({ coachIds: ["c1"] }), []);
});

test("sameIdSet compare sans tenir compte de l'ordre", () => {
  assert.equal(sameIdSet(["a", "b"], ["b", "a"]), true);
  assert.equal(sameIdSet(["a"], ["a", "b"]), false);
  assert.equal(sameIdSet([], []), true);
});
