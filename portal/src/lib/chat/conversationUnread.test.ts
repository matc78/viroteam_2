import { describe, expect, it } from "vitest";
import { makeChatState, makeConversation } from "./chatTestFixtures";
import { effectiveUnreadCount } from "./conversationUnread";

const lastAt = new Date(2026, 10, 3, 12, 0);

describe("effectiveUnreadCount", () => {
  it("conversation muette → 0, même avec un compteur Firestore", () => {
    expect(
      effectiveUnreadCount({
        conversation: makeConversation({ lastMessageAt: lastAt, lastSenderUid: "other" }),
        chatState: makeChatState({ muted: true, unreadCount: 4 }),
        viewerUid: "me",
      }),
    ).toBe(0);
  });

  it("priorité au compteur Firestore quand il est positif", () => {
    expect(
      effectiveUnreadCount({
        conversation: makeConversation(),
        chatState: makeChatState({ unreadCount: 3 }),
        viewerUid: "me",
      }),
    ).toBe(3);
  });

  it("pas de dernier message ou d’expéditeur → 0", () => {
    expect(
      effectiveUnreadCount({
        conversation: makeConversation({ lastSenderUid: "other" }),
        viewerUid: "me",
      }),
    ).toBe(0);
    expect(
      effectiveUnreadCount({
        conversation: makeConversation({ lastMessageAt: lastAt, lastSenderUid: "  " }),
        viewerUid: "me",
      }),
    ).toBe(0);
  });

  it("dernier message envoyé par le viewer → 0", () => {
    expect(
      effectiveUnreadCount({
        conversation: makeConversation({ lastMessageAt: lastAt, lastSenderUid: "me" }),
        viewerUid: "me",
      }),
    ).toBe(0);
  });

  it("jamais lu (pas de chatState ou lastReadAt absent) → 1", () => {
    const conversation = makeConversation({
      lastMessageAt: lastAt,
      lastSenderUid: "other",
    });
    expect(effectiveUnreadCount({ conversation, viewerUid: "me" })).toBe(1);
    expect(
      effectiveUnreadCount({
        conversation,
        chatState: makeChatState({ unreadCount: 0, lastReadAt: null }),
        viewerUid: "me",
      }),
    ).toBe(1);
  });

  it("fallback horodatage : message après la lecture → 1, avant ou égal → 0", () => {
    const conversation = makeConversation({
      lastMessageAt: lastAt,
      lastSenderUid: "other",
    });
    expect(
      effectiveUnreadCount({
        conversation,
        chatState: makeChatState({
          lastReadAt: new Date(lastAt.getTime() - 1000),
        }),
        viewerUid: "me",
      }),
    ).toBe(1);
    expect(
      effectiveUnreadCount({
        conversation,
        chatState: makeChatState({ lastReadAt: lastAt }),
        viewerUid: "me",
      }),
    ).toBe(0);
    expect(
      effectiveUnreadCount({
        conversation,
        chatState: makeChatState({
          lastReadAt: new Date(lastAt.getTime() + 1000),
        }),
        viewerUid: "me",
      }),
    ).toBe(0);
  });

  it("viewer inconnu : le message d’un autre compte comme non lu", () => {
    expect(
      effectiveUnreadCount({
        conversation: makeConversation({ lastMessageAt: lastAt, lastSenderUid: "me" }),
        viewerUid: null,
      }),
    ).toBe(1);
  });
});
