import { describe, expect, it } from "vitest";
import {
  defaultPracticeLocationSelectValue,
  PRACTICE_LOCATION_OTHER_VALUE,
  practiceLocationLabel,
  practiceLocationSelectValueFor,
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

describe("practiceLocationSelectValueFor", () => {
  const locations = [
    { name: "Gymnase", address: "1 rue A" },
    { name: "Terrain 2" },
  ];

  it("reconnaît un libellé club stocké", () => {
    expect(
      practiceLocationSelectValueFor(locations, "Gymnase (1 rue A)"),
    ).toBe("0");
  });

  it("reconnaît le nom seul", () => {
    expect(practiceLocationSelectValueFor(locations, "Terrain 2")).toBe("1");
  });

  it("retombe sur Autre pour une adresse libre", () => {
    expect(
      practiceLocationSelectValueFor(locations, "Stade adverse"),
    ).toBe(PRACTICE_LOCATION_OTHER_VALUE);
  });
});
