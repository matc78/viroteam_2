import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEventAudienceMigrationPatch,
  foldRsvpAliases,
  legacyRsvpIsNewer,
  migrateTeamMemberIds,
  planRsvpMigration,
  rsvpKeysOutsideAudience,
} from "./eventAudienceMigrate";

/** Timestamp Firestore minimal (seul `toMillis` est lu). */
const at = (millis: number) => ({ toMillis: () => millis });

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

test("planRsvpMigration preferLegacyWhenBoth écrase le canonique (repair)", () => {
  const plan = planRsvpMigration(
    { "mem-a": "no", "uid-a": "yes" },
    "mem-a",
    "uid-a",
    { preferLegacyWhenBoth: true },
  );
  assert.ok(plan);
  assert.equal(plan!.deleteLegacy, true);
  assert.equal(plan!.setCanonical, true);
  assert.equal(plan!.legacyValue, "no");
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

test("buildEventAudienceMigrationPatch preferLegacyWhenBoth écrase le RSVP canonique", () => {
  const deleteSentinel = Symbol("delete");
  const patch = buildEventAudienceMigrationPatch({
    teamMemberIds: ["uid-a"],
    rsvp: { "mem-a": "no", "uid-a": "yes" },
    rsvpUpdatedAt: { "mem-a": "ts-legacy" },
    legacyId: "mem-a",
    canonicalId: "uid-a",
    deleteField: deleteSentinel,
    preferLegacyWhenBoth: true,
  });
  assert.ok(patch);
  assert.equal(patch!["rsvp.mem-a"], deleteSentinel);
  assert.equal(patch!["rsvp.uid-a"], "no");
  assert.equal(patch!["rsvpUpdatedAt.mem-a"], deleteSentinel);
  assert.equal(patch!["rsvpUpdatedAt.uid-a"], "ts-legacy");
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

test("legacyRsvpIsNewer compare les horodatages rsvpUpdatedAt", () => {
  assert.equal(legacyRsvpIsNewer({ "mem-a": at(2), "uid-a": at(1) }, "mem-a", "uid-a"), true);
  assert.equal(legacyRsvpIsNewer({ "mem-a": at(1), "uid-a": at(2) }, "mem-a", "uid-a"), false);
  assert.equal(legacyRsvpIsNewer({ "mem-a": at(1) }, "mem-a", "uid-a"), true);
  assert.equal(legacyRsvpIsNewer({ "uid-a": at(1) }, "mem-a", "uid-a"), false);
});

test("rsvpKeysOutsideAudience liste les clés rsvp hors convocation (avant et après)", () => {
  assert.deepEqual(
    rsvpKeysOutsideAudience(
      { rsvp: { "mem-b": "no" } },
      { teamMemberIds: ["uid-a"], rsvp: { "uid-a": "none", "mem-a": "yes" } },
    ).sort(),
    ["mem-a", "mem-b"],
  );
});

test("foldRsvpAliases : le vote legacy récent masque le canonique périmé", () => {
  // Cas réel : vote « oui » de l'ancienne app sous memberId, `none` resté sous accountUid.
  const folded = foldRsvpAliases(
    {
      rsvp: { "mem-a": "yes", "uid-a": "none", other: "no" },
      rsvpUpdatedAt: { "mem-a": at(2), "uid-a": at(1) },
    },
    { "mem-a": "uid-a" },
  );
  assert.deepEqual(folded, { "uid-a": "yes", other: "no" });
});

test("foldRsvpAliases garde le canonique s'il est plus récent", () => {
  const folded = foldRsvpAliases(
    {
      rsvp: { "mem-a": "yes", "uid-a": "no" },
      rsvpUpdatedAt: { "mem-a": at(1), "uid-a": at(2) },
    },
    { "mem-a": "uid-a" },
  );
  assert.deepEqual(folded, { "uid-a": "no" });
});

test("foldRsvpAliases : la normalisation serveur ne crée pas de changement de statut", () => {
  const aliases = { "mem-a": "uid-a" };
  const beforeNormalize = {
    rsvp: { "mem-a": "yes", "uid-a": "none" },
    rsvpUpdatedAt: { "mem-a": at(2), "uid-a": at(1) },
  };
  const afterNormalize = { rsvp: { "uid-a": "yes" }, rsvpUpdatedAt: { "uid-a": at(2) } };
  assert.deepEqual(
    foldRsvpAliases(beforeNormalize, aliases),
    foldRsvpAliases(afterNormalize, aliases),
  );
});
