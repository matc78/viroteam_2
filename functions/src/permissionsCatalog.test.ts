import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CLUB_FUNCTIONS,
  CLUB_PERMISSIONS,
  COACH_FLAG_DEFAULTS,
  PERMISSION_ADMIN,
  PERMISSION_IMPLIES,
  coachFlagValue,
  derivedBadges,
  grantsPermission,
  normalizePermissions,
  primaryBadge,
  unknownPermissions,
} from "./permissionsCatalog";

const SHARED_CATALOG = path.join(
  __dirname,
  "..",
  "..",
  "shared",
  "permissions_catalog.json",
);

test("le catalogue Functions est identique au catalogue partagé", () => {
  const shared = JSON.parse(readFileSync(SHARED_CATALOG, "utf8"));
  assert.deepEqual([...CLUB_PERMISSIONS], shared.permissions);
  assert.equal(PERMISSION_ADMIN, shared.adminPermission);
  assert.deepEqual(PERMISSION_IMPLIES, shared.implies);
  assert.deepEqual(CLUB_FUNCTIONS, shared.functions);
  assert.equal(shared.templates, undefined);
  assert.deepEqual(COACH_FLAG_DEFAULTS, shared.coachFlags);
});

test("normalizePermissions trie, dédoublonne et ignore les inconnus", () => {
  assert.deepEqual(
    normalizePermissions(["viewActivity", "manageTeams", "manageTeams", "x", 3]),
    ["manageTeams", "viewActivity"],
  );
  assert.deepEqual(normalizePermissions(null), []);
});

test("normalizePermissions ajoute les droits impliqués", () => {
  assert.deepEqual(normalizePermissions(["manageFees"]), [
    "manageFees",
    "viewFees",
  ]);
});

test("normalizePermissions réduit la liste à admin", () => {
  assert.deepEqual(normalizePermissions(["manageFees", "admin"]), ["admin"]);
});

test("unknownPermissions liste les identifiants hors catalogue", () => {
  assert.deepEqual(unknownPermissions(["admin", "owner"]), ["owner"]);
  assert.deepEqual(unknownPermissions(["admin"]), []);
});

test("grantsPermission : admin accorde tout", () => {
  assert.equal(grantsPermission(["admin"], "manageFees"), true);
  assert.equal(grantsPermission(["viewFees"], "manageFees"), false);
  assert.equal(grantsPermission(["viewFees"], "viewFees"), true);
  assert.equal(grantsPermission(undefined, "viewFees"), false);
});

test("coachFlagValue applique le défaut du catalogue", () => {
  assert.equal(coachFlagValue(undefined, "canCreateEvents"), true);
  assert.equal(coachFlagValue({}, "canEditMemberRsvp"), false);
  assert.equal(coachFlagValue({ canCreateEvents: false }, "canCreateEvents"), false);
  assert.equal(coachFlagValue({ canEditMemberRsvp: true }, "canEditMemberRsvp"), true);
});

test("derivedBadges : admin, coach d'équipe, joueur d'effectif", () => {
  assert.deepEqual(
    derivedBadges({
      permissions: ["admin"],
      coachTeamIds: ["a"],
      teamIds: ["a", "b"],
    }),
    ["admin", "coach", "player"],
  );
  assert.deepEqual(derivedBadges({ teamIds: ["b"] }), ["player"]);
  assert.deepEqual(derivedBadges({ coachTeamIds: ["a"], teamIds: ["a"] }), [
    "coach",
  ]);
});

test("derivedBadges : badge Membre sans équipe ni droit admin", () => {
  assert.deepEqual(derivedBadges({ permissions: ["manageFees", "viewFees"] }), [
    "member",
  ]);
  assert.equal(primaryBadge({}), "member");
  assert.equal(primaryBadge({ coachTeamIds: ["a"], teamIds: ["b"] }), "coach");
});
