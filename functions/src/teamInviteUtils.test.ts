import test from "node:test";
import assert from "node:assert/strict";
import {
  INVITATION_TYPE_TEAM,
  TEAM_INVITE_MAX_USES,
  normalizePersonName,
  parseTeamInviteArgs,
  parseTeamInviteIdArgs,
  personNameKey,
  claimableMemberFromData,
  memberIsRetired,
  resolveClaimMemberId,
  teamInviteAcceptable,
  type ClaimableMember,
} from "./teamInviteUtils";

test("normalizePersonName retire accents et casse", () => {
  assert.equal(normalizePersonName("  Éléonore  "), "eleonore");
  assert.equal(normalizePersonName("Jean-Pierre"), "jean-pierre");
});

test("personNameKey exige prénom et nom", () => {
  assert.equal(personNameKey("Ada", "Lovelace"), "ada|lovelace");
  assert.equal(personNameKey("Ada", ""), "");
  assert.equal(personNameKey("", "Lovelace"), "");
});

/** Fiche pré-inscrite réclamable par défaut (surchargée par test). */
function member(overrides: Partial<ClaimableMember> = {}): ClaimableMember {
  return {
    memberId: "m1",
    accountUid: null,
    firstName: "Lucas",
    lastName: "Bernard",
    email: "lucas@example.com",
    teamIds: ["t1"],
    permissions: [],
    coachTeamIds: [],
    retired: false,
    ...overrides,
  };
}

test("resolveClaimMemberId réclame la fiche de l’équipe par e-mail vérifié unique", () => {
  const members = [member(), member({ memberId: "m2", email: "autre@example.com" })];
  assert.equal(
    resolveClaimMemberId({
      members,
      teamMemberIds: ["m1", "m2"],
      authEmail: " Lucas@Example.com ",
      emailVerified: true,
    }),
    "m1",
  );
});

test("resolveClaimMemberId refuse un e-mail non vérifié", () => {
  assert.equal(
    resolveClaimMemberId({
      members: [member()],
      teamMemberIds: ["m1"],
      authEmail: "lucas@example.com",
      emailVerified: false,
    }),
    null,
  );
});

test("resolveClaimMemberId ignore les fiches hors de l’équipe ciblée", () => {
  assert.equal(
    resolveClaimMemberId({
      members: [member()],
      teamMemberIds: ["m-autre"],
      authEmail: "lucas@example.com",
      emailVerified: true,
    }),
    null,
  );
});

test("resolveClaimMemberId ne réclame jamais une fiche avec droits ou équipes coachées", () => {
  for (const overrides of [
    { permissions: ["admin"] },
    { permissions: ["manageFees"] },
    { coachTeamIds: ["t1"] },
  ]) {
    assert.equal(
      resolveClaimMemberId({
        members: [member(overrides)],
        teamMemberIds: ["m1"],
        authEmail: "lucas@example.com",
        emailVerified: true,
      }),
      null,
      JSON.stringify(overrides),
    );
  }
});

test("resolveClaimMemberId ne réclame ni fiche liée ni fiche anonymisée", () => {
  for (const overrides of [{ accountUid: "uid-autre" }, { retired: true }]) {
    assert.equal(
      resolveClaimMemberId({
        members: [member(overrides)],
        teamMemberIds: ["m1"],
        authEmail: "lucas@example.com",
        emailVerified: true,
      }),
      null,
    );
  }
});

test("resolveClaimMemberId : prénom + nom seuls ne suffisent plus", () => {
  assert.equal(
    resolveClaimMemberId({
      members: [member({ email: "" })],
      teamMemberIds: ["m1"],
      authEmail: "lucas@example.com",
      emailVerified: true,
    }),
    null,
  );
});

test("resolveClaimMemberId refuse les doublons d’e-mail", () => {
  assert.equal(
    resolveClaimMemberId({
      members: [member(), member({ memberId: "m2" })],
      teamMemberIds: ["m1", "m2"],
      authEmail: "lucas@example.com",
      emailVerified: true,
    }),
    null,
  );
});

test("claimableMemberFromData lit droits, coachTeamIds et retrait", () => {
  const candidate = claimableMemberFromData(
    "m9",
    {
      firstName: " Léa ",
      snapshot: { email: "LEA@x.fr" },
      permissions: ["admin", 3],
      coachTeamIds: ["t2"],
      anonymizedAt: new Date(),
    },
    null,
  );
  assert.equal(candidate.email, "lea@x.fr");
  assert.deepEqual(candidate.permissions, ["admin"]);
  assert.deepEqual(candidate.coachTeamIds, ["t2"]);
  assert.equal(candidate.retired, true);
  assert.equal(memberIsRetired({ status: "archived" }), true);
  assert.equal(memberIsRetired({ status: "active" }), false);
});

test("teamInviteAcceptable refuse plafond et expiration", () => {
  const future = new Date(Date.now() + 86400000);
  assert.equal(
    teamInviteAcceptable({
      status: "pending",
      type: INVITATION_TYPE_TEAM,
      expiresAt: future,
      useCount: 29,
      maxUses: TEAM_INVITE_MAX_USES,
    }).ok,
    true,
  );
  assert.equal(
    teamInviteAcceptable({
      status: "pending",
      type: INVITATION_TYPE_TEAM,
      expiresAt: future,
      useCount: 30,
      maxUses: TEAM_INVITE_MAX_USES,
    }).ok,
    false,
  );
  assert.equal(
    teamInviteAcceptable({
      status: "pending",
      type: INVITATION_TYPE_TEAM,
      expiresAt: new Date(Date.now() - 1000),
      useCount: 0,
      maxUses: TEAM_INVITE_MAX_USES,
    }).ok,
    false,
  );
});

test("parseTeamInviteArgs trim et forceRefresh", () => {
  assert.deepEqual(
    parseTeamInviteArgs({
      clubId: " c1 ",
      teamId: " t1 ",
      forceRefresh: true,
    }),
    { clubId: "c1", teamId: "t1", forceRefresh: true },
  );
  assert.throws(() => parseTeamInviteArgs({ clubId: "c1" }));
});

test("parseTeamInviteIdArgs", () => {
  assert.deepEqual(
    parseTeamInviteIdArgs({ clubId: " c ", invitationId: " i " }),
    { clubId: "c", invitationId: "i" },
  );
});
