import { describe, expect, it, vi } from "vitest";

vi.mock("./app", () => ({ getAppFirestore: () => ({}) }));

const { eventCalendarDate } = await import("./eventService");

/** Jour local attendu (minuit), pour comparer sans dépendre du fuseau. */
function localDay(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getTime();
}

describe("eventCalendarDate", () => {
  it("lit dateId en priorité", () => {
    expect(
      eventCalendarDate({
        dateId: "20260519",
        date: new Date(Date.UTC(2026, 0, 1)),
      })?.getTime(),
    ).toBe(localDay(2026, 5, 19));
  });

  it("minuit UTC → même jour, quel que soit le fuseau du navigateur", () => {
    expect(
      eventCalendarDate({ date: new Date(Date.UTC(2026, 4, 19)) })?.getTime(),
    ).toBe(localDay(2026, 5, 19));
  });

  it("legacy minuit Europe (22h UTC la veille) → jour suivant", () => {
    expect(
      eventCalendarDate({ date: new Date(Date.UTC(2026, 4, 18, 22)) })?.getTime(),
    ).toBe(localDay(2026, 5, 19));
  });

  it("sans date → null", () => {
    expect(eventCalendarDate({})).toBeNull();
  });
});
