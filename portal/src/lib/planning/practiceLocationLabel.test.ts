import { describe, expect, it } from "vitest";
import {
  defaultPracticeLocationSelectValue,
  PRACTICE_LOCATION_OTHER_VALUE,
  practiceLocationLabel,
} from "./practiceLocationLabel";

describe("practiceLocationLabel", () => {
  it("retourne le nom seul sans adresse", () => {
    expect(practiceLocationLabel({ name: "Gymnase A" })).toBe("Gymnase A");
  });

  it("ajoute l’adresse entre parenthèses", () => {
    expect(
      practiceLocationLabel({
        name: "Stade municipal",
        address: "1 rue du Sport",
      }),
    ).toBe("Stade municipal (1 rue du Sport)");
  });
});

describe("defaultPracticeLocationSelectValue", () => {
  it("sélectionne le premier lieu s’il y en a", () => {
    expect(
      defaultPracticeLocationSelectValue([{ name: "Terrain 1" }]),
    ).toBe("0");
  });

  it("retombe sur Autre si la liste est vide", () => {
    expect(defaultPracticeLocationSelectValue([])).toBe(
      PRACTICE_LOCATION_OTHER_VALUE,
    );
  });
});
