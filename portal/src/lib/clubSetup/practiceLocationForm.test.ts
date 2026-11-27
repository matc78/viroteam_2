import { describe, expect, it } from "vitest";
import {
  emptyPracticeLocationForm,
  isPracticeLocationNameTaken,
  practiceLocationDetails,
  practiceLocationFormError,
  practiceLocationFromForm,
  practiceLocationToForm,
} from "./practiceLocationForm";

const valid = {
  name: " Gymnase Jean Macé ",
  category: "gymnasium",
  categoryCustom: "",
  city: "viroflay",
  address: " 12 rue de la République ",
};

describe("practiceLocationForm", () => {
  it("propose la catégorie du sport dans un formulaire vide", () => {
    expect(emptyPracticeLocationForm("Volleyball").category).toBe("gymnasium");
    expect(emptyPracticeLocationForm("Natation").category).toBe("pool");
  });

  it("exige nom, ville et adresse", () => {
    expect(practiceLocationFormError({ ...valid, name: " " })).not.toBeNull();
    expect(practiceLocationFormError({ ...valid, city: "" })).not.toBeNull();
    expect(practiceLocationFormError({ ...valid, address: "" })).not.toBeNull();
    expect(practiceLocationFormError(valid)).toBeNull();
  });

  it("exige un libellé pour la catégorie Autre", () => {
    const other = { ...valid, category: "other" };
    expect(practiceLocationFormError(other)).not.toBeNull();
    expect(
      practiceLocationFormError({ ...other, categoryCustom: "Plage" }),
    ).toBeNull();
  });

  it("formate le lieu et n’écrit le libellé libre que pour Autre", () => {
    expect(practiceLocationFromForm({ ...valid, categoryCustom: "x" })).toEqual({
      name: "Gymnase Jean Macé",
      city: "Viroflay",
      address: "12 rue de la République",
      category: "gymnasium",
    });
    expect(
      practiceLocationFromForm({
        ...valid,
        category: "other",
        categoryCustom: " Plage ",
      }).categoryCustom,
    ).toBe("Plage");
  });

  it("refuse de construire un lieu invalide", () => {
    expect(() => practiceLocationFromForm({ ...valid, name: "" })).toThrow();
  });

  it("relit un lieu existant dans le formulaire", () => {
    expect(
      practiceLocationToForm({ name: "Stade", city: "Versailles" }, "Football"),
    ).toEqual({
      name: "Stade",
      category: "stadium",
      categoryCustom: "",
      city: "Versailles",
      address: "",
    });
  });

  it("détecte un nom déjà pris sans tenir compte de la casse ni des accents", () => {
    const locations = [{ name: "Gymnase Macé" }, { name: "Stade" }];
    expect(isPracticeLocationNameTaken(locations, "gymnase mace")).toBe(true);
    expect(isPracticeLocationNameTaken(locations, "gymnase mace", 0)).toBe(
      false,
    );
    expect(isPracticeLocationNameTaken(locations, "Piscine")).toBe(false);
  });

  it("résume catégorie, adresse et ville", () => {
    expect(
      practiceLocationDetails({
        name: "Lac",
        category: "other",
        categoryCustom: "Plage",
        address: "Route du lac",
        city: "Annecy",
      }),
    ).toBe("Plage · Route du lac · Annecy");
  });
});
