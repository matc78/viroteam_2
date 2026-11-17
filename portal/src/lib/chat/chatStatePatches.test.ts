import { describe, expect, it } from "vitest";
import { applyChatStatePatches } from "./chatStatePatches";
import { makeChatState } from "./chatTestFixtures";

describe("applyChatStatePatches", () => {
  it("sans patch → même objet", () => {
    const states = { a: makeChatState({ id: "a" }) };
    expect(applyChatStatePatches(states, {})).toBe(states);
  });

  it("applique le patch sur l’état existant sans muter l’entrée", () => {
    const states = { a: makeChatState({ id: "a", muted: false, unreadCount: 3 }) };
    const next = applyChatStatePatches(states, { a: { muted: true } });
    expect(next.a?.muted).toBe(true);
    expect(next.a?.unreadCount).toBe(3);
    expect(states.a?.muted).toBe(false);
  });

  it("crée un état par défaut si absent", () => {
    const next = applyChatStatePatches({}, { b: { favorite: true } });
    expect(next.b).toEqual({
      id: "b",
      muted: false,
      favorite: true,
      lastReadAt: null,
      unreadCount: 0,
    });
  });
});
