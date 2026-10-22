import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEventAudienceMigrationPatch,
  migrateTeamMemberIds,
  planRsvpMigration,
} from "./eventAudienceMigrate";

test("migrateTeamMemberIds remplace et déduplique", () => {
  assert.deepEqual(
    migrateTeamMemberIds(["mem-a", "uid-b"], "mem-a", "uid-a"),
    ["uid-a", "uid-b"],
  );
  assert.deepEqual(
    migrateTeamMemberIds(["mem-a", "uid-a"], "mem-a", "uid-a"),
    ["uid-a"],
  );
  assert.equal(migrateTeamMemberIds(["uid-a"], "mem-a", "uid-a"), null);
});

test("planRsvpMigration déplace la valeur si canonique absente", () => {
  const plan = planRsvpMigration({ "mem-a": "yes" }, "mem-a", "uid-a");
  assert.ok(plan);
  assert.equal(plan!.deleteLegacy, true);
  assert.equal(plan!.setCanonical, true);
  assert.equal(plan!.legacyValue, "yes");
});

test("planRsvpMigration ne remplace pas un RSVP canonique existant", () => {
  const plan = planRsvpMigration(
    { "mem-a": "yes", "uid-a": "no" },
    "mem-a",
    "uid-a",
  );
  assert.ok(plan);
  assert.equal(plan!.setCanonical, false);
});

test("buildEventAudienceMigrationPatch combine ids et RSVP", () => {
  const deleteSentinel = Symbol("delete");
  const patch = buildEventAudienceMigrationPatch({
    teamMemberIds: ["mem-a", "other"],
    rsvp: { "mem-a": "maybe" },
    rsvpUpdatedAt: { "mem-a": "ts-legacy" },
    legacyId: "mem-a",
    canonicalId: "uid-a",
    deleteField: deleteSentinel,
  });
  assert.ok(patch);
  assert.deepEqual(patch!.teamMemberIds, ["uid-a", "other"]);
  assert.equal(patch!["rsvp.mem-a"], deleteSentinel);
  assert.equal(patch!["rsvp.uid-a"], "maybe");
  assert.equal(patch!["rsvpUpdatedAt.mem-a"], deleteSentinel);
  assert.equal(patch!["rsvpUpdatedAt.uid-a"], "ts-legacy");
});

test("buildEventAudienceMigrationPatch ne copie pas le timestamp si le RSVP canonique est conservé", () => {
  const deleteSentinel = Symbol("delete");
  const patch = buildEventAudienceMigrationPatch({
    teamMemberIds: ["uid-a"],
    rsvp: { "mem-a": "yes", "uid-a": "no" },
    rsvpUpdatedAt: { "mem-a": "ts-legacy" },
    legacyId: "mem-a",
    canonicalId: "uid-a",
    deleteField: deleteSentinel,
  });
  assert.ok(patch);
  assert.equal(patch!["rsvp.mem-a"], deleteSentinel);
  assert.equal("rsvp.uid-a" in patch!, false);
  assert.equal(patch!["rsvpUpdatedAt.mem-a"], deleteSentinel);
  assert.equal("rsvpUpdatedAt.uid-a" in patch!, false);
});

test("buildEventAudienceMigrationPatch migre seenAt sans écraser la vue canonique", () => {
  const deleteSentinel = Symbol("delete");
  const moved = buildEventAudienceMigrationPatch({
    teamMemberIds: [],
    rsvp: null,
    seenAt: { "mem-a": "seen-legacy" },
    legacyId: "mem-a",
    canonicalId: "uid-a",
    deleteField: deleteSentinel,
  });
  assert.ok(moved);
  assert.equal(moved!["seenAt.mem-a"], deleteSentinel);
  assert.equal(moved!["seenAt.uid-a"], "seen-legacy");

  const kept = buildEventAudienceMigrationPatch({
    teamMemberIds: [],
    rsvp: null,
    seenAt: { "mem-a": "seen-legacy", "uid-a": "seen-canonical" },
    legacyId: "mem-a",
    canonicalId: "uid-a",
    deleteField: deleteSentinel,
  });
  assert.ok(kept);
  assert.equal(kept!["seenAt.mem-a"], deleteSentinel);
  assert.equal("seenAt.uid-a" in kept!, false);
});
