import assert from "node:assert/strict";
import test from "node:test";
import {
  coachTeamIdsByMember,
  clubIndexGap,
  migratedPermissions,
  planClubMigration,
} from "./permissionsMigration";

const base = { wasInAdminIds: false, clubGrantedViewFeesToCoaches: false };

test("migratedPermissions convertit les anciens rôles par leur modèle", () => {
  assert.deepEqual(migratedPermissions({ ...base, member: { role: "admin" } }), [
    "admin",
  ]);
  assert.deepEqual(migratedPermissions({ ...base, member: { role: "coach" } }), [
    "viewActivity",
  ]);
  assert.deepEqual(migratedPermissions({ ...base, member: { role: "player" } }), []);
  assert.deepEqual(migratedPermissions({ ...base, member: {} }), []);
});

test("migratedPermissions : présent dans l'ancien adminIds ⇒ admin", () => {
  assert.deepEqual(
    migratedPermissions({ ...base, wasInAdminIds: true, member: { role: "coach" } }),
    ["admin"],
  );
});

test("migratedPermissions : les coachs gardent la lecture des cotisations si le club l'avait activée", () => {
  assert.deepEqual(
    migratedPermissions({
      ...base,
      clubGrantedViewFeesToCoaches: true,
      member: { role: "coach" },
    }),
    ["viewFees", "viewActivity"],
  );
  assert.deepEqual(
    migratedPermissions({
      ...base,
      clubGrantedViewFeesToCoaches: true,
      member: { role: "player" },
    }),
    [],
  );
});

test("migratedPermissions conserve des droits déjà migrés (relançable)", () => {
  assert.deepEqual(
    migratedPermissions({
      ...base,
      wasInAdminIds: true,
      member: { role: "admin", permissions: ["manageFees"] },
    }),
    ["manageFees", "viewFees"],
  );
  assert.deepEqual(
    migratedPermissions({ ...base, member: { role: "coach", permissions: [] } }),
    [],
  );
});

test("migratedPermissions : une fiche archivée n'a aucun droit", () => {
  assert.deepEqual(
    migratedPermissions({
      ...base,
      wasInAdminIds: true,
      member: { role: "admin", status: "archived" },
    }),
    [],
  );
});

test("coachTeamIdsByMember lit teams.coachIds", () => {
  const map = coachTeamIdsByMember([
    { id: "t2", data: { coachIds: ["c1", "c2"] } },
    { id: "t1", data: { coachIds: ["c1"] } },
    { id: "t3", data: {} },
  ]);
  assert.deepEqual(map.get("c1"), ["t1", "t2"]);
  assert.deepEqual(map.get("c2"), ["t2"]);
  assert.equal(map.get("x"), undefined);
});

test("planClubMigration : droits, équipes entraînées, index des admins et rapport", () => {
  const plan = planClubMigration({
    club: { adminIds: ["u-admin", "u-ghost"] },
    members: [
      { id: "u-admin", data: { role: "player", accountUid: "u-admin" } },
      { id: "u-coach", data: { role: "coach", accountUid: "u-coach" } },
      { id: "u-coach-seul", data: { role: "coach", accountUid: "u-coach-seul" } },
      { id: "mem-admin", data: { role: "admin" } },
      { id: "u-joueur", data: { role: "player", userId: "u-joueur" } },
    ],
    teams: [{ id: "t1", data: { coachIds: ["u-coach"] } }],
  });

  assert.deepEqual(plan.memberPatches, [
    { memberId: "u-admin", permissions: ["admin"], coachTeamIds: [] },
    { memberId: "u-coach", permissions: ["viewActivity"], coachTeamIds: ["t1"] },
    { memberId: "u-coach-seul", permissions: ["viewActivity"], coachTeamIds: [] },
    { memberId: "mem-admin", permissions: ["admin"], coachTeamIds: [] },
    { memberId: "u-joueur", permissions: [], coachTeamIds: [] },
  ]);
  assert.deepEqual(plan.adminIds, ["u-admin"]);
  assert.deepEqual(plan.report, {
    noLinkedAdmin: false,
    adminIdsWithoutMember: ["u-ghost"],
    unlinkedAdminMemberIds: ["mem-admin"],
    coachesWithoutTeam: ["u-coach-seul"],
  });
});

test("planClubMigration est un no-op sur un club déjà migré", () => {
  const plan = planClubMigration({
    club: { adminIds: ["u-admin"] },
    members: [
      {
        id: "u-admin",
        data: { accountUid: "u-admin", permissions: ["admin"], coachTeamIds: [] },
      },
      {
        id: "u-coach",
        data: {
          role: "coach",
          accountUid: "u-coach",
          permissions: ["viewActivity"],
          coachTeamIds: ["t1"],
        },
      },
    ],
    teams: [{ id: "t1", data: { coachIds: ["u-coach"] } }],
  });
  assert.deepEqual(plan.memberPatches, []);
  assert.equal(plan.adminIds, null);
  assert.deepEqual(plan.report.coachesWithoutTeam, []);
});

test("planClubMigration signale un club sans admin lié", () => {
  const plan = planClubMigration({
    club: {},
    members: [{ id: "mem-admin", data: { role: "admin" } }],
    teams: [],
  });
  assert.equal(plan.report.noLinkedAdmin, true);
  assert.equal(plan.adminIds, null);
});

test("clubIndexGap compare l'ancien index des clubs à memberClubIds", () => {
  assert.deepEqual(
    clubIndexGap([{ clubId: "c1", role: "admin" }, { clubId: "c2" }, "corrompu"], ["c2", "c3"]),
    { missing: ["c1"], extra: ["c3"] },
  );
  assert.deepEqual(clubIndexGap(undefined, undefined), { missing: [], extra: [] });
});
