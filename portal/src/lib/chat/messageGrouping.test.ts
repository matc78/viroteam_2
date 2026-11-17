import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildThreadRows, type ThreadRow } from "./buildThreadRows";
import { makeMessage } from "./chatTestFixtures";
import { canGroupMessages } from "./messageGrouping";

const at = (hour: number, minute = 0, day = 3) =>
  new Date(2026, 10, day, hour, minute);

/** Résumé : id + `<` (groupé au précédent) + `>` (groupé au suivant). */
function grouping(rows: ThreadRow[]): string[] {
  return rows.map((row) => {
    if (row.kind === "date") return "#";
    if (row.kind === "unread") return "NEW";
    return `${row.groupedWithPrevious ? "<" : ""}${row.id}${row.groupedWithNext ? ">" : ""}`;
  });
}

describe("canGroupMessages", () => {
  const base = makeMessage({ id: "a", senderUid: "u1", createdAt: at(10, 0) });

  it("même expéditeur, < 5 min → groupés", () => {
    const next = makeMessage({ id: "b", senderUid: "u1", createdAt: at(10, 4) });
    expect(canGroupMessages(base, next)).toBe(true);
  });

  it("5 minutes pile ou plus → pas groupés", () => {
    const next = makeMessage({ id: "b", senderUid: "u1", createdAt: at(10, 5) });
    expect(canGroupMessages(base, next)).toBe(false);
  });

  it("autre expéditeur → pas groupés", () => {
    const next = makeMessage({ id: "b", senderUid: "u2", createdAt: at(10, 1) });
    expect(canGroupMessages(base, next)).toBe(false);
  });

  it("jour local différent (autour de minuit) → pas groupés", () => {
    const late = makeMessage({ id: "a", senderUid: "u1", createdAt: at(23, 58, 2) });
    const early = makeMessage({ id: "b", senderUid: "u1", createdAt: at(0, 1, 3) });
    expect(canGroupMessages(late, early)).toBe(false);
  });

  it("message supprimé ou sondage → jamais groupé", () => {
    const deleted = makeMessage({
      id: "b",
      senderUid: "u1",
      createdAt: at(10, 1),
      deletedAt: at(10, 2),
    });
    const poll = makeMessage({
      id: "c",
      senderUid: "u1",
      createdAt: at(10, 1),
      type: "poll",
    });
    expect(canGroupMessages(base, deleted)).toBe(false);
    expect(canGroupMessages(deleted, base)).toBe(false);
    expect(canGroupMessages(base, poll)).toBe(false);
  });
});

describe("buildThreadRows — regroupement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at(18));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marque premier / milieu / dernier d’un groupe", () => {
    const messages = [
      makeMessage({ id: "a", senderUid: "u1", createdAt: at(10, 0) }),
      makeMessage({ id: "b", senderUid: "u1", createdAt: at(10, 1) }),
      makeMessage({ id: "c", senderUid: "u1", createdAt: at(10, 2) }),
      makeMessage({ id: "d", senderUid: "u2", createdAt: at(10, 3) }),
    ];
    expect(grouping(buildThreadRows({ messages, anchor: null }))).toEqual([
      "#",
      "a>",
      "<b>",
      "<c",
      "d",
    ]);
  });

  it("le séparateur « nouveau » coupe le groupe", () => {
    const messages = [
      makeMessage({ id: "a", senderUid: "u1", createdAt: at(10, 0) }),
      makeMessage({ id: "b", senderUid: "u1", createdAt: at(10, 1) }),
    ];
    expect(
      grouping(
        buildThreadRows({ messages, anchor: { kind: "count", count: 1 } }),
      ),
    ).toEqual(["#", "a", "NEW", "b"]);
  });

  it("le séparateur de jour coupe le groupe", () => {
    const messages = [
      makeMessage({ id: "a", senderUid: "u1", createdAt: at(23, 58, 2) }),
      makeMessage({ id: "b", senderUid: "u1", createdAt: at(0, 1, 3) }),
    ];
    expect(grouping(buildThreadRows({ messages, anchor: null }))).toEqual([
      "#",
      "a",
      "#",
      "b",
    ]);
  });
});
