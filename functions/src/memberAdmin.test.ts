import test from "node:test";
import assert from "node:assert/strict";
import {
  adminIdsWithout,
  decrementCount,
  isLastAdmin,
  nextAdminIds,
  parseRemoveMemberArgs,
  parseSetMemberRoleArgs,
  remainingAdminIdentities,
  withMembershipRole,
  withoutMembership,
} from "./memberAdminUtils";

const isInvalidArgument = (error: unknown) =>
  error instanceof Error && (error as { code?: string }).code === "invalid-argument";

test("parseSetMemberRoleArgs valide et trim", () => {
  assert.deepEqual(
    parseSetMemberRoleArgs({ clubId: " c1 ", memberId: " m1 ", role: "coach" }),
    { clubId: "c1", memberId: "m1", role: "coach" },
  );
});

test("parseSetMemberRoleArgs refuse rôle inconnu ou champs manquants", () => {
  assert.throws(() => parseSetMemberRoleArgs({}), isInvalidArgument);
  assert.throws(
    () => parseSetMemberRoleArgs({ clubId: "c1", memberId: "m1" }),
    isInvalidArgument,
  );
  assert.throws(
    () => parseSetMemberRoleArgs({ clubId: "c1", memberId: "m1", role: "owner" }),
    isInvalidArgument,
  );
  assert.throws(
    () => parseSetMemberRoleArgs({ clubId: "c1", memberId: "m1", role: "ADMIN" }),
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

test("isLastAdmin : seul admin (adminIds + fiche) ⇒ true", () => {
  assert.equal(
    isLastAdmin({
      adminIds: ["uid-a"],
      adminMembers: [{ memberId: "m-a", accountUid: "uid-a" }],
      target: { memberId: "m-a", accountUid: "uid-a" },
    }),
    true,
  );
});

test("isLastAdmin : un autre uid dans adminIds ⇒ false", () => {
  assert.equal(
    isLastAdmin({
      adminIds: ["uid-a", "uid-b"],
      adminMembers: [{ memberId: "m-a", accountUid: "uid-a" }],
      target: { memberId: "m-a", accountUid: "uid-a" },
    }),
    false,
  );
});

test("isLastAdmin : autre fiche admin non liée compte (memberId) ⇒ false", () => {
  assert.equal(
    isLastAdmin({
      adminIds: ["uid-a"],
      adminMembers: [
        { memberId: "m-a", accountUid: "uid-a" },
        { memberId: "m-b", accountUid: null },
      ],
      target: { memberId: "m-a", accountUid: "uid-a" },
    }),
    false,
  );
});

test("isLastAdmin : fiche non liée, seule dans adminIds par memberId ⇒ true", () => {
  assert.equal(
    isLastAdmin({
      adminIds: ["m-a"],
      adminMembers: [{ memberId: "m-a", accountUid: null }],
      target: { memberId: "m-a", accountUid: null },
    }),
    true,
  );
});

test("remainingAdminIdentities dédoublonne et exclut la cible", () => {
  assert.deepEqual(
    remainingAdminIdentities({
      adminIds: ["uid-a", "uid-b", "uid-b"],
      adminMembers: [
        { memberId: "m-a", accountUid: "uid-a" },
        { memberId: "m-b", accountUid: "uid-b" },
      ],
      target: { memberId: "m-a", accountUid: "uid-a" },
    }),
    ["uid-b"],
  );
});

test("nextAdminIds ajoute à la promotion, retire à la rétrogradation", () => {
  assert.deepEqual(
    nextAdminIds({ adminIds: ["u1"], accountUid: "u2", oldRole: "coach", newRole: "admin" }),
    ["u1", "u2"],
  );
  assert.deepEqual(
    nextAdminIds({ adminIds: ["u1", "u2"], accountUid: "u2", oldRole: "admin", newRole: "player" }),
    ["u1"],
  );
  // Déjà présent : pas de doublon.
  assert.deepEqual(
    nextAdminIds({ adminIds: ["u1", "u2"], accountUid: "u2", oldRole: "admin", newRole: "admin" }),
    ["u1", "u2"],
  );
  // Coach → player : inchangé.
  assert.deepEqual(
    nextAdminIds({ adminIds: ["u1"], accountUid: "u2", oldRole: "coach", newRole: "player" }),
    ["u1"],
  );
  // Fiche non liée : inchangé.
  assert.deepEqual(
    nextAdminIds({ adminIds: ["u1"], accountUid: null, oldRole: "player", newRole: "admin" }),
    ["u1"],
  );
});

test("adminIdsWithout retire memberId et accountUid", () => {
  assert.deepEqual(
    adminIdsWithout(["u1", "m2", "u2", "u3"], { memberId: "m2", accountUid: "u2" }),
    ["u1", "u3"],
  );
});

test("withMembershipRole met à jour l'entrée du club sans perdre les autres champs", () => {
  const raw = [
    { clubId: "c1", role: "player", joinedAt: "x" },
    { clubId: "c2", role: "coach" },
    "corrompu",
    null,
  ];
  assert.deepEqual(withMembershipRole(raw, "c1", "admin"), [
    { clubId: "c1", role: "admin", joinedAt: "x" },
    { clubId: "c2", role: "coach" },
  ]);
});

test("withMembershipRole ajoute l'entrée si absente", () => {
  assert.deepEqual(withMembershipRole(undefined, "c1", "coach"), [
    { clubId: "c1", role: "coach" },
  ]);
});

test("withoutMembership retire le club", () => {
  assert.deepEqual(
    withoutMembership([{ clubId: "c1", role: "admin" }, { clubId: "c2", role: "player" }], "c1"),
    [{ clubId: "c2", role: "player" }],
  );
});

test("decrementCount ne descend pas sous zéro", () => {
  assert.equal(decrementCount(3), 2);
  assert.equal(decrementCount(0), 0);
  assert.equal(decrementCount(undefined), 0);
  assert.equal(decrementCount("abc"), 0);
});
