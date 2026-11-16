import test from "node:test";
import assert from "node:assert/strict";
import {
  decrementCount,
  parseRemoveMemberArgs,
  parseSetMemberPermissionsArgs,
} from "./memberAdminUtils";
import {
  adminIdsAfterPermissionsChange,
  adminIdsUpdate,
  buildClubAccess,
  isLastAdmin,
  isStaffMember,
} from "./permissionsCatalog";
import { parseCreateClubArgs } from "./createClubUtils";

const isInvalidArgument = (error: unknown) =>
  error instanceof Error && (error as { code?: string }).code === "invalid-argument";

test("parseSetMemberPermissionsArgs valide, trim et normalise", () => {
  assert.deepEqual(
    parseSetMemberPermissionsArgs({
      clubId: " c1 ",
      memberId: " m1 ",
      permissions: ["viewActivity", "manageFees"],
    }),
    {
      clubId: "c1",
      memberId: "m1",
      permissions: ["manageFees", "viewFees", "viewActivity"],
    },
  );
  assert.deepEqual(
    parseSetMemberPermissionsArgs({ clubId: "c1", memberId: "m1", permissions: [] }),
    { clubId: "c1", memberId: "m1", permissions: [] },
  );
});

test("parseSetMemberPermissionsArgs refuse droit inconnu ou champs manquants", () => {
  assert.throws(() => parseSetMemberPermissionsArgs({}), isInvalidArgument);
  assert.throws(
    () => parseSetMemberPermissionsArgs({ clubId: "c1", memberId: "m1" }),
    isInvalidArgument,
  );
  assert.throws(
    () =>
      parseSetMemberPermissionsArgs({
        clubId: "c1",
        memberId: "m1",
        permissions: ["owner"],
      }),
    isInvalidArgument,
  );
  assert.throws(
    () =>
      parseSetMemberPermissionsArgs({
        clubId: "c1",
        memberId: "m1",
        permissions: "admin",
      }),
    isInvalidArgument,
  );
});

test("parseRemoveMemberArgs exige clubId et memberId", () => {
  assert.deepEqual(parseRemoveMemberArgs({ clubId: "c1", memberId: "m1" }), {
    clubId: "c1",
    memberId: "m1",
  });
  assert.throws(() => parseRemoveMemberArgs({ clubId: "c1" }), isInvalidArgument);
  assert.throws(() => parseRemoveMemberArgs(undefined), isInvalidArgument);
});

test("isLastAdmin : seul compte de l'index ⇒ true", () => {
  assert.equal(isLastAdmin({ adminIds: ["uid-a"], memberId: "uid-a" }), true);
  assert.equal(isLastAdmin({ adminIds: [], memberId: "uid-a" }), true);
});

test("isLastAdmin : un autre compte admin ⇒ false", () => {
  assert.equal(
    isLastAdmin({ adminIds: ["uid-a", "uid-b"], memberId: "uid-a" }),
    false,
  );
});

test("adminIdsUpdate renvoie null si l'index ne change pas", () => {
  const base = { memberId: "u2", linked: true };
  assert.equal(
    adminIdsUpdate({ ...base, adminIds: ["u1", "u2"], permissions: ["admin"] }),
    null,
  );
  assert.deepEqual(
    adminIdsUpdate({ ...base, adminIds: ["u1"], permissions: ["admin"] }),
    ["u1", "u2"],
  );
  // Retrait (fiche supprimée ou compte supprimé).
  assert.deepEqual(
    adminIdsUpdate({ ...base, linked: false, adminIds: ["u1", "u2"], permissions: [] }),
    ["u1"],
  );
  // Re-keying : l'ancien id quitte l'index, le nouveau y entre.
  assert.deepEqual(
    adminIdsUpdate({
      ...base,
      adminIds: ["u1", "old"],
      permissions: ["admin"],
      formerMemberIds: ["old"],
    }),
    ["u1", "u2"],
  );
});

test("adminIdsAfterPermissionsChange suit le droit admin des fiches liées", () => {
  assert.deepEqual(
    adminIdsAfterPermissionsChange({
      adminIds: ["u1"],
      memberId: "u2",
      linked: true,
      permissions: ["admin"],
    }),
    ["u1", "u2"],
  );
  assert.deepEqual(
    adminIdsAfterPermissionsChange({
      adminIds: ["u1", "u2"],
      memberId: "u2",
      linked: true,
      permissions: ["manageFees"],
    }),
    ["u1"],
  );
  assert.deepEqual(
    adminIdsAfterPermissionsChange({
      adminIds: ["u1", "u2"],
      memberId: "u2",
      linked: true,
      permissions: ["admin"],
    }),
    ["u1", "u2"],
  );
});

test("adminIdsAfterPermissionsChange : une fiche non liée n'entre pas dans l'index", () => {
  assert.deepEqual(
    adminIdsAfterPermissionsChange({
      adminIds: ["u1"],
      memberId: "mem-x",
      linked: false,
      permissions: ["admin"],
    }),
    ["u1"],
  );
});

test("buildClubAccess : droits de la fiche, admin accorde tout", () => {
  const admin = buildClubAccess({
    clubId: "c1",
    uid: "u1",
    club: {},
    member: { permissions: ["admin"] },
  });
  assert.equal(admin.isAdmin, true);
  assert.equal(admin.can("manageFees"), true);

  const treasurer = buildClubAccess({
    clubId: "c1",
    uid: "u2",
    club: {},
    member: { permissions: ["manageFees", "viewFees"] },
  });
  assert.equal(treasurer.isAdmin, false);
  assert.equal(treasurer.can("viewFees"), true);
  assert.equal(treasurer.can("manageMembers"), false);
});

test("buildClubAccess : sans fiche, aucun droit", () => {
  const access = buildClubAccess({ clubId: "c1", uid: "u9", club: {}, member: null });
  assert.equal(access.can("viewActivity"), false);
  assert.equal(access.isTeamCoach, false);
  assert.equal(access.coachCan("canCreateEvents"), false);
});

test("buildClubAccess : le coach d'équipe agit sur ses équipes selon les flags du club", () => {
  const coach = buildClubAccess({
    clubId: "c1",
    uid: "u3",
    club: { coachPermissions: { canCreateEvents: false, canEditMemberRsvp: true } },
    member: { coachTeamIds: ["a", "b"] },
  });
  assert.equal(coach.coachesAnyTeam(["b", "z"]), true);
  assert.equal(coach.coachesAnyTeam(["z"]), false);
  assert.equal(coach.coachesAllTeams(["a", "b"]), true);
  assert.equal(coach.coachesAllTeams(["a", "z"]), false);
  assert.equal(coach.coachesAllTeams([]), false);
  assert.equal(coach.coachCan("canCreateEvents"), false);
  assert.equal(coach.coachCan("canEditMemberRsvp"), true);
  assert.equal(coach.coachCan("canInvitePlayers"), true);
  assert.equal(coach.can("manageEvents"), false);
});

test("isStaffMember : au moins un droit ou une équipe entraînée", () => {
  assert.equal(isStaffMember({ permissions: ["viewFees"] }), true);
  assert.equal(isStaffMember({ coachTeamIds: ["a"] }), true);
  assert.equal(isStaffMember({ permissions: [], coachTeamIds: [] }), false);
  assert.equal(isStaffMember({ permissions: ["inconnu"] }), false);
});

test("decrementCount ne descend pas sous zéro", () => {
  assert.equal(decrementCount(3), 2);
  assert.equal(decrementCount(0), 0);
  assert.equal(decrementCount(undefined), 0);
  assert.equal(decrementCount("abc"), 0);
});

test("parseCreateClubArgs valide et nettoie le brouillon", () => {
  assert.deepEqual(
    parseCreateClubArgs({
      name: " Volley Club ",
      sport: "volley",
      city: "Lyon",
      brandColorHex: "#1E88E5",
      practiceLocations: [{ name: " Gymnase ", city: "Lyon", category: "" }],
      seasonEndDateMs: 1785000000000,
    }),
    {
      name: "Volley Club",
      sport: "volley",
      city: "Lyon",
      postalCode: "",
      address: "",
      description: "",
      brandColorHex: "#1E88E5",
      practiceLocations: [{ name: "Gymnase", city: "Lyon" }],
      seasonEndDateMs: 1785000000000,
    },
  );
});

test("parseCreateClubArgs refuse un brouillon incomplet", () => {
  const valid = {
    name: "Club",
    sport: "volley",
    city: "Lyon",
    brandColorHex: "#1E88E5",
    seasonEndDateMs: 1785000000000,
  };
  assert.throws(() => parseCreateClubArgs({ ...valid, name: " " }), isInvalidArgument);
  assert.throws(
    () => parseCreateClubArgs({ ...valid, seasonEndDateMs: "demain" }),
    isInvalidArgument,
  );
  assert.throws(
    () => parseCreateClubArgs({ ...valid, practiceLocations: [{ city: "Lyon" }] }),
    isInvalidArgument,
  );
  assert.throws(
    () => parseCreateClubArgs({ ...valid, adminIds: ["x"], name: 3 }),
    isInvalidArgument,
  );
});
