import { describe, expect, it } from "vitest";
import {
  emptyPlanningFilters,
  resolveAdminPlanningFilters,
} from "./planningFiltersStorage";

describe("resolveAdminPlanningFilters", () => {
  const options = {
    teamIds: new Set(["t1", "t2"]),
    coachIds: new Set(["c1"]),
    categories: new Set(["U15"]),
  };

  it("pré-coche toutes les équipes si teamIds est vide", () => {
    const result = resolveAdminPlanningFilters(emptyPlanningFilters(), options);
    expect(result.teamIds).toEqual(["t1", "t2"]);
    expect(result.playerIds).toEqual([]);
  });

  it("conserve les équipes déjà cochées et vide playerIds", () => {
    const result = resolveAdminPlanningFilters(
      {
        teamIds: ["t2"],
        coachIds: ["c1"],
        categories: ["U15"],
        playerIds: ["p-old"],
      },
      options,
    );
    expect(result.teamIds).toEqual(["t2"]);
    expect(result.coachIds).toEqual(["c1"]);
    expect(result.categories).toEqual(["U15"]);
    expect(result.playerIds).toEqual([]);
  });

  it("retire les ids d’équipes / coachs hors options", () => {
    const result = resolveAdminPlanningFilters(
      {
        teamIds: ["t1", "gone"],
        coachIds: ["gone-coach"],
        categories: [],
        playerIds: ["p1"],
      },
      options,
    );
    expect(result.teamIds).toEqual(["t1"]);
    expect(result.coachIds).toEqual([]);
    expect(result.playerIds).toEqual([]);
  });
});
