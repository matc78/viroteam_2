import { describe, expect, it, vi } from "vitest";
import {
  makeChatState,
  makeConversation,
} from "@/lib/chat/chatTestFixtures";

vi.mock("./app", () => ({
  getAppFirestore: () => ({}),
  getFirebaseApp: () => ({}),
  getFirestoreDatabaseId: () => "v2-dev",
}));

const { canWriteToConversation, sortInboxConversations } = await import(
  "./chatService"
);

describe("canWriteToConversation", () => {
  const roles = ["admin", "coach", "player", null] as const;

  it("non-participant → jamais, quelle que soit la policy", () => {
    for (const writePolicy of ["open", "admins_only", "coaches_and_admins"]) {
      for (const clubRole of roles) {
        expect(
          canWriteToConversation({
            conversation: makeConversation({ writePolicy }),
            uid: "intrus",
            clubRole,
          }),
        ).toBe(false);
      }
    }
  });

  it("policy open : tout participant, y compris parent (rôle null)", () => {
    for (const clubRole of roles) {
      expect(
        canWriteToConversation({
          conversation: makeConversation({ writePolicy: "open" }),
          uid: "me",
          clubRole,
        }),
      ).toBe(true);
    }
  });

  it("admins_only : admin seulement", () => {
    const conversation = makeConversation({ writePolicy: "admins_only" });
    expect(
      roles.map((clubRole) =>
        canWriteToConversation({ conversation, uid: "me", clubRole }),
      ),
    ).toEqual([true, false, false, false]);
  });

  it("coaches_and_admins : admin et coach", () => {
    const conversation = makeConversation({ writePolicy: "coaches_and_admins" });
    expect(
      roles.map((clubRole) =>
        canWriteToConversation({ conversation, uid: "me", clubRole }),
      ),
    ).toEqual([true, true, false, false]);
  });

  it("policy inconnue ou vide → traitée comme open", () => {
    expect(
      canWriteToConversation({
        conversation: makeConversation({ writePolicy: "" }),
        uid: "me",
        clubRole: null,
      }),
    ).toBe(true);
  });
});

describe("sortInboxConversations", () => {
  const at = (day: number) => new Date(2026, 10, day, 12, 0);

  it("favoris en tête, puis date du dernier message décroissante", () => {
    const old = makeConversation({ id: "old", lastMessageAt: at(1) });
    const recent = makeConversation({ id: "recent", lastMessageAt: at(3) });
    const favOld = makeConversation({ id: "favOld", lastMessageAt: at(2) });
    const sorted = sortInboxConversations([old, recent, favOld], {
      club1_favOld: makeChatState({ id: "club1_favOld", favorite: true }),
    });
    expect(sorted.map((c) => c.id)).toEqual(["favOld", "recent", "old"]);
  });

  it("sans dernier message : retombe sur createdAt, puis 0", () => {
    const created = makeConversation({ id: "created", createdAt: at(2) });
    const empty = makeConversation({ id: "empty" });
    const withMessage = makeConversation({
      id: "withMessage",
      lastMessageAt: at(1),
      createdAt: at(5),
    });
    expect(
      sortInboxConversations([empty, withMessage, created], {}).map((c) => c.id),
    ).toEqual(["created", "withMessage", "empty"]);
  });

  it("clé d’état par club : un favori d’un autre club ne compte pas", () => {
    const a = makeConversation({ id: "a", clubId: "club1", lastMessageAt: at(1) });
    const b = makeConversation({ id: "a", clubId: "club2", lastMessageAt: at(2) });
    const sorted = sortInboxConversations([b, a], {
      club1_a: makeChatState({ favorite: true }),
    });
    expect(sorted.map((c) => c.clubId)).toEqual(["club1", "club2"]);
  });

  it("ne mute pas le tableau d’entrée", () => {
    const list = [
      makeConversation({ id: "a", lastMessageAt: at(1) }),
      makeConversation({ id: "b", lastMessageAt: at(2) }),
    ];
    const sorted = sortInboxConversations(list, {});
    expect(sorted).not.toBe(list);
    expect(list.map((c) => c.id)).toEqual(["a", "b"]);
  });
});
