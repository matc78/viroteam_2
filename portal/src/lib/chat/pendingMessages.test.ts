import { describe, expect, it } from "vitest";
import { makeMessage } from "./chatTestFixtures";
import { mergePendingMessages } from "./pendingMessages";
import { toggleReactionUid } from "./reactionToggle";
import { countMessagesAfter } from "./threadMessages";

const at = (minute: number) => new Date(2026, 10, 3, 10, minute);

describe("mergePendingMessages", () => {
  const server = [
    makeMessage({ id: "a", createdAt: at(0) }),
    makeMessage({ id: "b", createdAt: at(2) }),
  ];

  it("sans envoi en attente → messages serveur inchangés", () => {
    const merged = mergePendingMessages(server, []);
    expect(merged.messages).toBe(server);
    expect(merged.deliveryById).toEqual({});
  });

  it("ajoute l’envoi absent du snapshot, trié par date", () => {
    const pending = makeMessage({ id: "p", createdAt: at(1), senderUid: "me" });
    const merged = mergePendingMessages(server, [
      { message: pending, status: "sending" },
    ]);
    expect(merged.messages.map((message) => message.id)).toEqual([
      "a",
      "p",
      "b",
    ]);
    expect(merged.deliveryById).toEqual({ p: "sending" });
  });

  it("envoi déjà dans le snapshot → pas de doublon, statut conservé", () => {
    const merged = mergePendingMessages(server, [
      { message: makeMessage({ id: "b", createdAt: at(2) }), status: "sending" },
    ]);
    expect(merged.messages.map((message) => message.id)).toEqual(["a", "b"]);
    expect(merged.deliveryById).toEqual({ b: "sending" });
  });

  it("envoi échoué reste affiché avec son statut", () => {
    const failed = makeMessage({ id: "f", createdAt: at(3) });
    const merged = mergePendingMessages(server, [
      { message: failed, status: "failed" },
    ]);
    expect(merged.messages.at(-1)?.id).toBe("f");
    expect(merged.deliveryById.f).toBe("failed");
  });
});

describe("toggleReactionUid", () => {
  it("ajoute puis retire, supprime la clé vide, sans muter l’entrée", () => {
    const initial = { "👍": ["u1"] };
    const added = toggleReactionUid(initial, "👍", "u2");
    expect(added).toEqual({ "👍": ["u1", "u2"] });
    expect(initial).toEqual({ "👍": ["u1"] });
    expect(toggleReactionUid(added, "👍", "u2")).toEqual({ "👍": ["u1"] });
    expect(toggleReactionUid(initial, "👍", "u1")).toEqual({});
    expect(toggleReactionUid({}, "🔥", "u1")).toEqual({ "🔥": ["u1"] });
  });
});

describe("countMessagesAfter", () => {
  const messages = [
    makeMessage({ id: "a" }),
    makeMessage({ id: "b" }),
    makeMessage({ id: "c" }),
  ];

  it("compte les messages après l’id", () => {
    expect(countMessagesAfter(messages, "a")).toBe(2);
    expect(countMessagesAfter(messages, "c")).toBe(0);
  });

  it("id null ou introuvable → 0", () => {
    expect(countMessagesAfter(messages, null)).toBe(0);
    expect(countMessagesAfter(messages, "zz")).toBe(0);
  });
});
