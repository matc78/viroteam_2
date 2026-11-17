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
    { memberId: "u-coach-seul", permissions: [], coachTeamIds: [] },
    { memberId: "mem-admin", permissions: ["admin"], coachTeamIds: [] },
    { memberId: "u-joueur", permissions: [], coachTeamIds: [] },
  ]);
  assert.deepEqual(plan.adminIds, ["u-admin"]);
  assert.equal(plan.deleteClub, false);
  assert.deepEqual(plan.report, {
    noLinkedAdmin: false,
    promotedAdminMemberId: null,
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

test("planClubMigration : sans fiche liée, un admin en attente de liaison suffit", () => {
  const plan = planClubMigration({
    club: {},
    members: [
      { id: "mem-admin", data: { role: "admin" } },
      { id: "mem-joueur", data: { role: "player", joinedAt: 1 } },
    ],
    teams: [],
  });
  assert.equal(plan.report.noLinkedAdmin, true);
  assert.equal(plan.report.promotedAdminMemberId, null);
  assert.equal(plan.adminIds, null);
});

test("planClubMigration supprime un club sans aucune fiche membre", () => {
  const plan = planClubMigration({ club: { adminIds: ["u-parti"] }, members: [], teams: [] });
  assert.equal(plan.deleteClub, true);
  assert.deepEqual(plan.memberPatches, []);
  assert.deepEqual(plan.report.adminIdsWithoutMember, ["u-parti"]);
});

test("planClubMigration supprime un club dont toutes les fiches sont archivées", () => {
  const plan = planClubMigration({
    club: {},
    members: [{ id: "u-supprime", data: { role: "admin", status: "archived" } }],
    teams: [{ id: "t1", data: {} }],
  });
  assert.equal(plan.deleteClub, true);
});

test("planClubMigration promeut admin le premier membre lié arrivé faute d'admin lié", () => {
  const plan = planClubMigration({
    club: { adminIds: ["u-parti"] },
    members: [
      { id: "mem-ancien", data: { role: "player", joinedAt: 1 } },
      { id: "u-recent", data: { role: "player", accountUid: "u-recent", joinedAt: 30 } },
      {
        id: "u-premier",
        data: { role: "coach", accountUid: "u-premier", joinedAt: { toMillis: () => 20 } },
      },
      { id: "mem-admin", data: { role: "admin", joinedAt: 5 } },
      { id: "u-archive", data: { role: "player", accountUid: "u-archive", joinedAt: 0, status: "archived" } },
    ],
    teams: [],
  });
  assert.equal(plan.report.promotedAdminMemberId, "u-premier");
  assert.equal(plan.report.noLinkedAdmin, false);
  assert.deepEqual(plan.adminIds, ["u-premier"]);
  assert.deepEqual(plan.report.coachesWithoutTeam, []);
  assert.deepEqual(
    plan.memberPatches.find((patch) => patch.memberId === "u-premier")?.permissions,
    ["admin"],
  );
  assert.deepEqual(plan.report.unlinkedAdminMemberIds, ["mem-admin"]);
});

test("planClubMigration : sans fiche liée ni admin, la première fiche arrivée est promue", () => {
  const plan = planClubMigration({
    club: {},
    members: [
      { id: "mem-b", data: { role: "player", joinedAt: 10 } },
      { id: "mem-a", data: { role: "player", joinedAt: 2 } },
    ],
    teams: [],
  });
  assert.equal(plan.report.promotedAdminMemberId, "mem-a");
  assert.equal(plan.report.noLinkedAdmin, true);
  assert.deepEqual(plan.report.unlinkedAdminMemberIds, ["mem-a"]);
});

test("planClubMigration : promotion faite une seule fois (relançable)", () => {
  const plan = planClubMigration({
    club: { adminIds: ["u-promu"] },
    members: [
      {
        id: "u-promu",
        data: { role: "player", accountUid: "u-promu", permissions: ["admin"], coachTeamIds: [] },
      },
      { id: "u-autre", data: { accountUid: "u-autre", permissions: [], coachTeamIds: [] } },
    ],
    teams: [],
  });
  assert.equal(plan.report.promotedAdminMemberId, null);
  assert.deepEqual(plan.memberPatches, []);
  assert.equal(plan.adminIds, null);
});

test("migratedPermissions : un ancien coach sans équipe devient membre", () => {
  assert.deepEqual(
    migratedPermissions({ ...base, coachesATeam: false, member: { role: "coach" } }),
    [],
  );
  assert.deepEqual(
    migratedPermissions({
      ...base,
      coachesATeam: false,
      wasInAdminIds: true,
      member: { role: "coach" },
    }),
    ["admin"],
  );
});

test("clubIndexGap compare l'ancien index des clubs à memberClubIds", () => {
  assert.deepEqual(
    clubIndexGap([{ clubId: "c1", role: "admin" }, { clubId: "c2" }, "corrompu"], ["c2", "c3"]),
    { missing: ["c1"], extra: ["c3"] },
  );
  assert.deepEqual(clubIndexGap(undefined, undefined), { missing: [], extra: [] });
});
