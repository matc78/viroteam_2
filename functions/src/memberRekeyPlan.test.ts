import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEventRekeyPatch,
  buildTeamRekeyPatch,
  feeIsEmpty,
  feeMoveDecision,
  mergeMemberDocs,
  rewriteParentLinks,
} from "./memberRekeyPlan";

/** Timestamp Firestore minimal (seul `toMillis` est lu). */
const at = (millis: number) => ({ toMillis: () => millis });
const DELETE = "<delete>";

test("buildTeamRekeyPatch remplace dans playerIds / coachIds en dédupliquant", () => {
  assert.deepEqual(
    buildTeamRekeyPatch(
      { playerIds: ["mem-a", "uid-a", "uid-b"], coachIds: ["mem-a"] },
      "mem-a",
      "uid-a",
    ),
    { playerIds: ["uid-a", "uid-b"], coachIds: ["uid-a"] },
  );
});

test("buildTeamRekeyPatch promeut une fiche en attente en joueur", () => {
  assert.deepEqual(
    buildTeamRekeyPatch(
      { playerIds: ["uid-b"], pendingPlayerIds: ["mem-a", "pending-x"] },
      "mem-a",
      "uid-a",
    ),
    { playerIds: ["uid-b", "uid-a"], pendingPlayerIds: ["pending-x"] },
  );
});

test("buildTeamRekeyPatch est idempotent", () => {
  const team = { playerIds: ["mem-a"], coachIds: [], pendingPlayerIds: [] };
  const patch = buildTeamRekeyPatch(team, "mem-a", "uid-a");
  assert.ok(patch);
  assert.equal(buildTeamRekeyPatch({ ...team, ...patch }, "mem-a", "uid-a"), null);
});

test("buildEventRekeyPatch migre audience, exclusions, appel et seenAt", () => {
  const seen = at(5);
  const patch = buildEventRekeyPatch({
    event: {
      teamMemberIds: ["mem-a", "uid-b"],
      excludedMemberIds: ["mem-a"],
      attendance: { "mem-a": { status: "present" } },
      seenAt: { "mem-a": seen },
    },
    from: "mem-a",
    to: "uid-a",
    deleteField: DELETE,
  });
  assert.deepEqual(patch, {
    teamMemberIds: ["uid-a", "uid-b"],
    excludedMemberIds: ["uid-a"],
    "attendance.mem-a": DELETE,
    "attendance.uid-a": { status: "present" },
    "seenAt.mem-a": DELETE,
    "seenAt.uid-a": seen,
  });
});

test("buildEventRekeyPatch : le vote le plus récent gagne", () => {
  const legacyNewer = buildEventRekeyPatch({
    event: {
      rsvp: { "mem-a": "no", "uid-a": "yes" },
      rsvpUpdatedAt: { "mem-a": at(20), "uid-a": at(10) },
    },
    from: "mem-a",
    to: "uid-a",
    deleteField: DELETE,
  });
  assert.equal(legacyNewer?.["rsvp.uid-a"], "no");
  assert.equal(legacyNewer?.["rsvp.mem-a"], DELETE);

  const canonicalNewer = buildEventRekeyPatch({
    event: {
      rsvp: { "mem-a": "no", "uid-a": "yes" },
      rsvpUpdatedAt: { "mem-a": at(10), "uid-a": at(20) },
    },
    from: "mem-a",
    to: "uid-a",
    deleteField: DELETE,
  });
  assert.equal("rsvp.uid-a" in (canonicalNewer ?? {}), false);
  assert.equal(canonicalNewer?.["rsvp.mem-a"], DELETE);
});

test("buildEventRekeyPatch garde un appel déjà fait sous la clé canonique", () => {
  const patch = buildEventRekeyPatch({
    event: { attendance: { "mem-a": { status: "absent" }, "uid-a": { status: "present" } } },
    from: "mem-a",
    to: "uid-a",
    deleteField: DELETE,
  });
  assert.deepEqual(patch, { "attendance.mem-a": DELETE });
});

test("buildEventRekeyPatch sans référence à l'ancien id → null", () => {
  assert.equal(
    buildEventRekeyPatch({
      event: { teamMemberIds: ["uid-a"], rsvp: { "uid-a": "yes" } },
      from: "mem-a",
      to: "uid-a",
      deleteField: DELETE,
    }),
    null,
  );
});

test("rewriteParentLinks réécrit le lien du club et garde l'actif en cas de doublon", () => {
  assert.deepEqual(
    rewriteParentLinks(
      [
        { clubId: "c1", memberId: "mem-a", relation: "parent", status: "active" },
        { clubId: "c1", memberId: "uid-a", relation: "parent", status: "pending" },
        { clubId: "c2", memberId: "mem-a", relation: "parent", status: "active" },
      ],
      "c1",
      "mem-a",
      "uid-a",
    ),
    [
      { clubId: "c2", memberId: "mem-a", relation: "parent", status: "active" },
      { clubId: "c1", memberId: "uid-a", relation: "parent", status: "active" },
    ],
  );
  assert.equal(
    rewriteParentLinks([{ clubId: "c1", memberId: "uid-a" }], "c1", "mem-a", "uid-a"),
    null,
  );
});

test("mergeMemberDocs ne rétrograde jamais le rôle et réunit les équipes", () => {
  const merged = mergeMemberDocs(
    {
      role: "admin",
      teamIds: ["t1"],
      firstName: "Louka",
      playerInfo: { license: "123" },
      joinedAt: at(1),
      status: "pending",
    },
    {
      role: "player",
      teamIds: ["t2"],
      firstName: "Louka-compte",
      playerInfo: {},
      joinedAt: at(9),
      status: "active",
    },
  );
  assert.equal(merged.role, "admin");
  assert.deepEqual(merged.teamIds, ["t1", "t2"]);
  assert.equal(merged.firstName, "Louka-compte");
  assert.deepEqual(merged.playerInfo, { license: "123" });
  assert.equal((merged.joinedAt as { toMillis: () => number }).toMillis(), 1);
  assert.equal(merged.status, "active");
});

test("feeMoveDecision couvre chaque cas", () => {
  const empty = { data: { amountPaidCents: 0, aids: [] }, paymentEventCount: 0 };
  const paid = { data: { amountPaidCents: 5000 }, paymentEventCount: 1 };
  assert.equal(feeIsEmpty(empty), true);
  assert.equal(feeIsEmpty({ data: { aids: [{ amountCents: 10 }] }, paymentEventCount: 0 }), false);
  assert.equal(feeMoveDecision(null, paid), "none");
  assert.equal(feeMoveDecision(paid, null), "move");
  assert.equal(feeMoveDecision(empty, paid), "drop-empty-source");
  assert.equal(feeMoveDecision(paid, empty), "drop-empty-target-then-move");
  assert.equal(feeMoveDecision(paid, paid), "conflict");
});
