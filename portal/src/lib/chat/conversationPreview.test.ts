import { describe, expect, it } from "vitest";
import { makeConversation } from "./chatTestFixtures";
import {
  previewSenderKey,
  previewSenderRoleTone,
  resolveConversationPreviewSender,
} from "./conversationPreview";

describe("previewSenderKey", () => {
  it("assemble clubId:uid", () => {
    expect(previewSenderKey("club1", "u1")).toBe("club1:u1");
  });
});

describe("previewSenderRoleTone", () => {
  it("garde admin / coach / parent", () => {
    expect(previewSenderRoleTone("admin")).toBe("admin");
    expect(previewSenderRoleTone("coach")).toBe("coach");
    expect(previewSenderRoleTone("parent")).toBe("parent");
  });

  it("tout le reste retombe sur player", () => {
    expect(previewSenderRoleTone("player")).toBe("player");
    expect(previewSenderRoleTone("inconnu")).toBe("player");
    expect(previewSenderRoleTone("")).toBe("player");
    expect(previewSenderRoleTone(null)).toBe("player");
    expect(previewSenderRoleTone(undefined)).toBe("player");
  });
});

describe("resolveConversationPreviewSender", () => {
  it("priorité aux champs persistés (prénom trimé, rôle normalisé)", () => {
    expect(
      resolveConversationPreviewSender(
        makeConversation({
          lastSenderUid: "u1",
          lastSenderFirstName: "  Léa ",
          lastSenderRole: "coach",
        }),
        { "club1:u1": { firstName: "Autre", role: "admin" } },
      ),
    ).toEqual({ firstName: "Léa", role: "coach" });
  });

  it("prénom persisté sans rôle → player", () => {
    expect(
      resolveConversationPreviewSender(
        makeConversation({ lastSenderFirstName: "Sam", lastSenderRole: null }),
      ),
    ).toEqual({ firstName: "Sam", role: "player" });
  });

  it("sinon lit l’annuaire `clubId:uid`", () => {
    expect(
      resolveConversationPreviewSender(
        makeConversation({ lastSenderUid: "u1", lastSenderRole: "admin" }),
        { "club1:u1": { firstName: " Tom ", role: "" } },
      ),
    ).toEqual({ firstName: "Tom", role: "admin" });
    expect(
      resolveConversationPreviewSender(
        makeConversation({ lastSenderUid: "u1" }),
        { "club1:u1": { firstName: "Tom", role: "parent" } },
      ),
    ).toEqual({ firstName: "Tom", role: "parent" });
  });

  it("null sans uid, sans annuaire, ou prénom d’annuaire vide", () => {
    expect(resolveConversationPreviewSender(makeConversation())).toBeNull();
    expect(
      resolveConversationPreviewSender(makeConversation({ lastSenderUid: "u1" })),
    ).toBeNull();
    expect(
      resolveConversationPreviewSender(makeConversation({ lastSenderUid: "u1" }), {
        "club1:u1": { firstName: "   ", role: "coach" },
      }),
    ).toBeNull();
    expect(
      resolveConversationPreviewSender(makeConversation({ lastSenderUid: "u1" }), {
        "club2:u1": { firstName: "Tom", role: "coach" },
      }),
    ).toBeNull();
  });
});
