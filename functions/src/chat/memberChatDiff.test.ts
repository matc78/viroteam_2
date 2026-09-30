import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memberChatFieldsChanged } from "./memberChatDiff";

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
