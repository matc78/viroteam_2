import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildThreadRows,
  resolveUnreadSeparatorAnchor,
  type ThreadRow,
} from "./buildThreadRows";
import {
  makeChatState,
  makeConversation,
  makeMessage,
} from "./chatTestFixtures";

/** Résumé lisible des lignes : `#jour`, `NEW`, ou id du message. */
function shape(rows: ThreadRow[]): string[] {
  return rows.map((row) => {
    if (row.kind === "date") return `#${row.label}`;
    if (row.kind === "unread") return "NEW";
    return row.id;
  });
}

const day3 = (hour: number, minute = 0) => new Date(2026, 10, 3, hour, minute);
const day2 = (hour: number) => new Date(2026, 10, 2, hour, 0);

describe("buildThreadRows", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 3, 18, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aucun message → aucune ligne", () => {
    expect(buildThreadRows({ messages: [], anchor: { kind: "count", count: 3 } })).toEqual([]);
  });

  it("un séparateur par jour calendaire", () => {
    const rows = buildThreadRows({
      messages: [
        makeMessage({ id: "a", createdAt: day2(9) }),
        makeMessage({ id: "b", createdAt: day2(20) }),
        makeMessage({ id: "c", createdAt: day3(8) }),
      ],
      anchor: null,
    });
    expect(shape(rows)).toEqual(["#Hier", "a", "b", "#Aujourd'hui", "c"]);
  });

  it("ids de séparateur uniques, même autour de minuit (jour local)", () => {
    const rows = buildThreadRows({
      messages: [
        makeMessage({ id: "a", createdAt: day2(23) }),
        makeMessage({ id: "b", createdAt: day3(0, 30) }),
        makeMessage({ id: "c", createdAt: day3(1, 30) }),
      ],
      anchor: null,
    });
    const dateIds = rows.filter((row) => row.kind === "date").map((row) => row.id);
    expect(dateIds).toEqual(["date-2026-11-02", "date-2026-11-03"]);
  });

  it("ancre count : séparateur avant les N derniers messages", () => {
    const messages = ["a", "b", "c", "d"].map((id, index) =>
      makeMessage({ id, createdAt: day3(8 + index) }),
    );
    expect(
      shape(buildThreadRows({ messages, anchor: { kind: "count", count: 2 } })),
    ).toEqual(["#Aujourd'hui", "a", "b", "NEW", "c", "d"]);
  });

  it("ancre count ≥ nombre de messages : séparateur en tête (après le jour)", () => {
    const messages = [
      makeMessage({ id: "a", createdAt: day3(8) }),
      makeMessage({ id: "b", createdAt: day3(9) }),
    ];
    expect(
      shape(buildThreadRows({ messages, anchor: { kind: "count", count: 10 } })),
    ).toEqual(["#Aujourd'hui", "NEW", "a", "b"]);
  });

  it("ancre count à 0 ou ancre nulle : pas de séparateur", () => {
    const messages = [makeMessage({ id: "a", createdAt: day3(8) })];
    expect(
      shape(buildThreadRows({ messages, anchor: { kind: "count", count: 0 } })),
    ).toEqual(["#Aujourd'hui", "a"]);
    expect(shape(buildThreadRows({ messages, anchor: null }))).toEqual([
      "#Aujourd'hui",
      "a",
    ]);
  });

  it("ancre after : premier message d’un autre après lastReadAt, une seule fois", () => {
    const messages = [
      makeMessage({ id: "lu", createdAt: day3(8), senderUid: "other" }),
      makeMessage({ id: "moi", createdAt: day3(10), senderUid: "me" }),
      makeMessage({ id: "nouveau", createdAt: day3(11), senderUid: "other" }),
      makeMessage({ id: "suite", createdAt: day3(12), senderUid: "other" }),
    ];
    expect(
      shape(
        buildThreadRows({
          messages,
          anchor: { kind: "after", afterMs: day3(9).getTime() },
          viewerUid: "me",
        }),
      ),
    ).toEqual(["#Aujourd'hui", "lu", "moi", "NEW", "nouveau", "suite"]);
  });

  it("ancre after : message pile à lastReadAt = déjà lu", () => {
    const messages = [makeMessage({ id: "a", createdAt: day3(9) })];
    expect(
      shape(
        buildThreadRows({
          messages,
          anchor: { kind: "after", afterMs: day3(9).getTime() },
          viewerUid: "me",
        }),
      ),
    ).toEqual(["#Aujourd'hui", "a"]);
  });
});

describe("resolveUnreadSeparatorAnchor", () => {
  const lastAt = new Date(2026, 10, 3, 12, 0);
  const unreadConversation = makeConversation({
    lastMessageAt: lastAt,
    lastSenderUid: "other",
  });

  it("rien de non lu → null", () => {
    expect(
      resolveUnreadSeparatorAnchor({
        conversation: makeConversation({ lastMessageAt: lastAt, lastSenderUid: "me" }),
        viewerUid: "me",
      }),
    ).toBeNull();
    expect(
      resolveUnreadSeparatorAnchor({
        conversation: unreadConversation,
        chatState: makeChatState({ muted: true, unreadCount: 3 }),
        viewerUid: "me",
      }),
    ).toBeNull();
  });

  it("compteur Firestore positif → ancre count", () => {
    expect(
      resolveUnreadSeparatorAnchor({
        conversation: unreadConversation,
        chatState: makeChatState({ unreadCount: 4, lastReadAt: new Date(0) }),
        viewerUid: "me",
      }),
    ).toEqual({ kind: "count", count: 4 });
  });

  it("compteur à 0 mais lastReadAt plus ancien → ancre after", () => {
    const readAt = new Date(lastAt.getTime() - 60_000);
    expect(
      resolveUnreadSeparatorAnchor({
        conversation: unreadConversation,
        chatState: makeChatState({ lastReadAt: readAt }),
        viewerUid: "me",
      }),
    ).toEqual({ kind: "after", afterMs: readAt.getTime() });
  });

  it("jamais lu, sans chatState → ancre count effective (1)", () => {
    expect(
      resolveUnreadSeparatorAnchor({
        conversation: unreadConversation,
        viewerUid: "me",
      }),
    ).toEqual({ kind: "count", count: 1 });
  });

  it("conversation pas encore chargée : compteur Firestore, sauf muet", () => {
    expect(
      resolveUnreadSeparatorAnchor({
        conversation: null,
        chatState: makeChatState({ unreadCount: 2 }),
      }),
    ).toEqual({ kind: "count", count: 2 });
    expect(
      resolveUnreadSeparatorAnchor({
        conversation: null,
        chatState: makeChatState({ unreadCount: 2, muted: true }),
      }),
    ).toBeNull();
    expect(resolveUnreadSeparatorAnchor({ conversation: null })).toBeNull();
  });
});
