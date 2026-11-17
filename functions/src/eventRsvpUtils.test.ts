import test from "node:test";
import assert from "node:assert/strict";
import { isSafeMemberMapKey, staffRsvpTargetDecision } from "./eventRsvpUtils";

test("isSafeMemberMapKey refuse « . », « / » et ids réservés", () => {
  assert.equal(isSafeMemberMapKey("uid123"), true);
  assert.equal(isSafeMemberMapKey("a.b"), false);
  assert.equal(isSafeMemberMapKey("a/b"), false);
  assert.equal(isSafeMemberMapKey("__name__"), false);
  assert.equal(isSafeMemberMapKey(""), false);
});

const event = { teamIds: ["t1"], teamMemberIds: ["m1", "m2"] };

test("staffRsvpTargetDecision exige une fiche existante et convoquée", () => {
  const base = {
    event,
    targetTeamIds: ["t1"],
    canManageEvents: true,
    coachTeamIds: [],
  };
  const missing = staffRsvpTargetDecision({ ...base, targetMemberId: "m1", targetExists: false });
  assert.equal(!missing.ok && missing.code, "not-found");
  const notConvoked = staffRsvpTargetDecision({
    ...base,
    targetMemberId: "m3",
    targetExists: true,
  });
  assert.equal(!notConvoked.ok && notConvoked.code, "failed-precondition");
  assert.equal(
    staffRsvpTargetDecision({ ...base, targetMemberId: "m1", targetExists: true }).ok,
    true,
  );
});

test("staffRsvpTargetDecision : un coach ne répond que pour ses équipes", () => {
  const base = {
    event,
    targetMemberId: "m2",
    targetExists: true,
    canManageEvents: false,
  };
  const outside = staffRsvpTargetDecision({
    ...base,
    targetTeamIds: ["t9"],
    coachTeamIds: ["t1"],
  });
  assert.equal(!outside.ok && outside.code, "permission-denied");
  assert.equal(
    staffRsvpTargetDecision({ ...base, targetTeamIds: ["t1"], coachTeamIds: ["t1"] }).ok,
    true,
  );
});
