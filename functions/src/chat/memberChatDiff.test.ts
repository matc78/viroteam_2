import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHAT_CLOSED_POLICY,
  memberChatDelta,
  memberChatFieldsChanged,
  parseChannelScopeSystemKey,
  writePolicyAfterRemoval,
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

  it("profil ou équipes seuls → rien (le trigger d'équipe gère les équipes)", () => {
    assert.equal(
      memberChatFieldsChanged(base, { ...base, firstName: "Pierre", snapshot: { x: 1 } }),
      false,
    );
    assert.equal(memberChatFieldsChanged(base, { ...base, teamIds: ["teamA"] }), false);
  });

  it("rôle, statut ou compte → resync", () => {
    assert.equal(memberChatFieldsChanged(base, { ...base, role: "coach" }), true);
    assert.equal(memberChatFieldsChanged(base, { ...base, status: "archived" }), true);
    assert.equal(memberChatFieldsChanged(base, { ...base, accountUid: "u2" }), true);
  });
});

describe("memberChatDelta", () => {
  const player = { role: "player", status: "active", accountUid: "u1" };
  const none = { add: [], remove: [] };

  it("arrivée d'un joueur avec compte → chat club seulement", () => {
    assert.deepEqual(memberChatDelta(undefined, player), {
      club: { add: ["u1"], remove: [] },
      staff: none,
      leftUids: [],
    });
  });

  it("fiche sans compte → aucun effet", () => {
    assert.deepEqual(memberChatDelta(undefined, { role: "player", status: "active" }), {
      club: none,
      staff: none,
      leftUids: [],
    });
  });

  it("promotion coach → staff, sans toucher au chat club", () => {
    assert.deepEqual(memberChatDelta(player, { ...player, role: "coach" }), {
      club: none,
      staff: { add: ["u1"], remove: [] },
      leftUids: [],
    });
  });

  it("archivage ou suppression d'un coach → sort de partout", () => {
    const coach = { ...player, role: "coach" };
    const expected = {
      club: { add: [], remove: ["u1"] },
      staff: { add: [], remove: ["u1"] },
      leftUids: ["u1"],
    };
    assert.deepEqual(memberChatDelta(coach, { ...coach, status: "archived" }), expected);
    assert.deepEqual(memberChatDelta(coach, undefined), expected);
  });

  it("changement de compte lié → l'ancien uid part, le nouveau arrive", () => {
    assert.deepEqual(memberChatDelta(player, { ...player, accountUid: "u2" }), {
      club: { add: ["u2"], remove: ["u1"] },
      staff: none,
      leftUids: ["u1"],
    });
  });
});

describe("parseChannelScopeSystemKey", () => {
  it("relit les trois formes de canaux ciblés", () => {
    assert.deepEqual(parseChannelScopeSystemKey("category:U11|U13"), {
      scopeType: "categories",
      scopeIds: ["U11", "U13"],
    });
    assert.deepEqual(parseChannelScopeSystemKey("custom-teams:t1|t2"), {
      scopeType: "teams",
      scopeIds: ["t1", "t2"],
    });
    assert.deepEqual(parseChannelScopeSystemKey("custom-parents:t1"), {
      scopeType: "parents",
      scopeIds: ["t1"],
    });
  });

  it("clé système d'une autre nature ou vide → null", () => {
    assert.equal(parseChannelScopeSystemKey("team:t1"), null);
    assert.equal(parseChannelScopeSystemKey("category:"), null);
    assert.equal(parseChannelScopeSystemKey(undefined), null);
  });
});

describe("writePolicyAfterRemoval", () => {
  it("DM réduit à un participant → fermé", () => {
    assert.equal(
      writePolicyAfterRemoval({
        type: "dm",
        participantUids: ["u1", "u2"],
        removedUid: "u2",
        writePolicy: "open",
      }),
      CHAT_CLOSED_POLICY,
    );
  });

  it("groupe coachs encore à plusieurs, ou canal → politique inchangée", () => {
    assert.equal(
      writePolicyAfterRemoval({
        type: "coach_group",
        participantUids: ["u1", "u2", "u3"],
        removedUid: "u3",
        writePolicy: "open",
      }),
      "open",
    );
    assert.equal(
      writePolicyAfterRemoval({
        type: "category",
        participantUids: ["u1", "u2"],
        removedUid: "u2",
        writePolicy: "admins_only",
      }),
      "admins_only",
    );
  });
});
