import test from "node:test";
import assert from "node:assert/strict";
import {
  INVITATION_TYPE_TEAM,
  TEAM_INVITE_MAX_USES,
  normalizePersonName,
  parseTeamInviteArgs,
  parseTeamInviteIdArgs,
  personNameKey,
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

test("resolveClaimMemberId priorise l’e-mail unique", () => {
  const members: ClaimableMember[] = [
    {
      memberId: "m1",
      accountUid: null,
      firstName: "Lucas",
      lastName: "Bernard",
      email: "lucas@example.com",
      teamIds: [],
    },
    {
      memberId: "m2",
      accountUid: null,
      firstName: "Autre",
      lastName: "Nom",
      email: "",
      teamIds: [],
    },
  ];
  assert.equal(
    resolveClaimMemberId({
      members,
      authEmail: "lucas@example.com",
      firstName: "X",
      lastName: "Y",
    }),
    "m1",
  );
});

test("resolveClaimMemberId claim par nom unique si pas d’e-mail", () => {
  const members: ClaimableMember[] = [
    {
      memberId: "m1",
      accountUid: null,
      firstName: "Léa",
      lastName: "Martin",
      email: "",
      teamIds: [],
    },
    {
      memberId: "m2",
      accountUid: "uid-other",
      firstName: "Léa",
      lastName: "Martin",
      email: "",
      teamIds: [],
    },
  ];
  assert.equal(
    resolveClaimMemberId({
      members,
      authEmail: "lea@example.com",
      firstName: "Lea",
      lastName: "Martin",
    }),
    "m1",
  );
});

test("resolveClaimMemberId refuse les homonymes", () => {
  const members: ClaimableMember[] = [
    {
      memberId: "m1",
      accountUid: null,
      firstName: "Thomas",
      lastName: "Martin",
      email: "",
      teamIds: [],
    },
    {
      memberId: "m2",
      accountUid: null,
      firstName: "Thomas",
      lastName: "Martin",
      email: "",
      teamIds: [],
    },
  ];
  assert.equal(
    resolveClaimMemberId({
      members,
      authEmail: "t@example.com",
      firstName: "Thomas",
      lastName: "Martin",
    }),
    null,
  );
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
