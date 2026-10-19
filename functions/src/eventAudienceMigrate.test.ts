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
    legacyId: "mem-a",
    canonicalId: "uid-a",
    deleteField: deleteSentinel,
  });
  assert.ok(patch);
  assert.deepEqual(patch!.teamMemberIds, ["uid-a", "other"]);
  assert.equal(patch!["rsvp.mem-a"], deleteSentinel);
  assert.equal(patch!["rsvp.uid-a"], "maybe");
});
