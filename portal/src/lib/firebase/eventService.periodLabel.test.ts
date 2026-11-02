import { describe, expect, it, vi } from "vitest";

vi.mock("./app", () => ({ getAppFirestore: () => ({}) }));

const { formatCalendarPeriodLabel } = await import("./eventService");

/** Espaces insécables `Intl` → espaces simples pour comparer. */
function normalize(label: string): string {
  return label.replace(/[  ]/g, " ");
}

describe("formatCalendarPeriodLabel", () => {
  it("semaine dans un seul mois", () => {
    expect(
      normalize(formatCalendarPeriodLabel(new Date(2026, 10, 4), "week")),
    ).toBe("2 – 8 nov. 2026");
  });

  it("semaine à cheval sur deux mois : mois courts des deux côtés", () => {
    expect(
      normalize(formatCalendarPeriodLabel(new Date(2026, 9, 28), "week")),
    ).toBe("26 oct. – 1 nov. 2026");
  });

  it("semaine à cheval sur deux années : année des deux côtés", () => {
    expect(
      normalize(formatCalendarPeriodLabel(new Date(2026, 11, 30), "week")),
    ).toBe("28 déc. 2026 – 3 janv. 2027");
  });

  it("vues mois et jour : première lettre en capitale", () => {
    expect(
      normalize(formatCalendarPeriodLabel(new Date(2026, 10, 2), "month")),
    ).toBe("Novembre 2026");
    expect(
      normalize(formatCalendarPeriodLabel(new Date(2026, 10, 2), "day")),
    ).toBe("Lundi 2 novembre 2026");
  });
});
