import { describe, expect, it } from "vitest";
import { assignTeamCategoryTones } from "./teamCategoryTone";

describe("couleurs des catégories d’équipe", () => {
  it("donne une couleur différente à chacune des 11 premières catégories", () => {
    const categories = [
      "M7", "M9", "M11", "M13", "M15", "M18", "M21",
      "Loisir", "Sénior", "Soft", "Vétéran",
    ];
    const tones = assignTeamCategoryTones(categories);
    expect(new Set(tones.values()).size).toBe(11);
  });

  it("réserve le gris à « Sans catégorie » sans décaler les autres", () => {
    const tones = assignTeamCategoryTones(["M7", "Sans catégorie", "M9"]);
    expect(tones.get("Sans catégorie")).toBe("slate");
    expect(tones.get("M7")).toBe("blue");
    expect(tones.get("M9")).toBe("orange");
  });
});
