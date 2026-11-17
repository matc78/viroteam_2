import { describe, expect, it } from "vitest";
import { allPlanningQueriesSettled } from "./usePlanningChangeListener";

describe("allPlanningQueriesSettled", () => {
  it("attend toutes les équipes", () => {
    expect(allPlanningQueriesSettled(new Map([["t1", 1]]), new Set(), 2)).toBe(
      false,
    );
  });

  it("compte une équipe en erreur comme répondue", () => {
    expect(
      allPlanningQueriesSettled(new Map([["t1", 1]]), new Set(["t2"]), 2),
    ).toBe(true);
  });

  it("ne compte pas deux fois une équipe répondue puis en erreur", () => {
    expect(
      allPlanningQueriesSettled(new Map([["t1", 1]]), new Set(["t1"]), 2),
    ).toBe(false);
  });
});
