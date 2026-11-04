import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  memberChatFieldsChanged,
  memberProfileFieldsChanged,
  userProfileFieldsChanged,
} from "./memberChatDiff";

describe("memberChatFieldsChanged", () => {
  const base = {
    role: "player",
    status: "active",
    accountUid: "u1",
    teamIds: ["teamB", "teamA"],
    firstName: "Paul",
  };

  it("création / suppression → resync", () => {
    assert.equal(memberChatFieldsChanged(undefined, base), true);
    assert.equal(memberChatFieldsChanged(base, undefined), true);
  });

  it("changement de profil seul → pas de resync", () => {
    assert.equal(
      memberChatFieldsChanged(base, { ...base, firstName: "Pierre", snapshot: { x: 1 } }),
      false,
    );
  });

  it("même équipes dans un autre ordre → pas de resync", () => {
    assert.equal(
      memberChatFieldsChanged(base, { ...base, teamIds: ["teamA", "teamB"] }),
      false,
    );
  });

  it("rôle, statut, compte ou équipes → resync", () => {
    assert.equal(memberChatFieldsChanged(base, { ...base, role: "coach" }), true);
    assert.equal(memberChatFieldsChanged(base, { ...base, status: "archived" }), true);
    assert.equal(memberChatFieldsChanged(base, { ...base, accountUid: "u2" }), true);
    assert.equal(memberChatFieldsChanged(base, { ...base, teamIds: ["teamA"] }), true);
  });
});

describe("memberProfileFieldsChanged", () => {
  const base = {
    firstName: "Paul",
    lastName: "Durand",
    snapshot: { displayName: "Paul Durand", avatarUrl: "a.jpg", rsvp: 1 },
  };

  it("nom ou photo du snapshot → profil à rafraîchir", () => {
    assert.equal(memberProfileFieldsChanged(base, { ...base, firstName: "Pierre" }), true);
    assert.equal(
      memberProfileFieldsChanged(base, {
        ...base,
        snapshot: { ...base.snapshot, avatarUrl: "b.jpg" },
      }),
      true,
    );
  });

  it("autre champ du snapshot, création ou suppression → rien", () => {
    assert.equal(
      memberProfileFieldsChanged(base, {
        ...base,
        snapshot: { ...base.snapshot, rsvp: 2 },
      }),
      false,
    );
    assert.equal(memberProfileFieldsChanged(undefined, base), false);
    assert.equal(memberProfileFieldsChanged(base, undefined), false);
  });
});

describe("userProfileFieldsChanged", () => {
  const base = { firstName: "Sam", displayName: "Sam L.", fcm: "x" };

  it("nom ou photo → profil à rafraîchir, autre champ → rien", () => {
    assert.equal(userProfileFieldsChanged(base, { ...base, avatarUrl: "a.jpg" }), true);
    assert.equal(userProfileFieldsChanged(base, { ...base, fcm: "y" }), false);
  });
});
