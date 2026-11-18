import { describe, expect, it } from "vitest";
import {
  isPasswordValid,
  passwordRequirements,
  validatePassword,
} from "./passwordPolicy";

describe("passwordRequirements", () => {
  it("marque toutes les règles non remplies pour une chaîne vide", () => {
    const requirements = passwordRequirements("");
    expect(requirements.every((requirement) => !requirement.met)).toBe(true);
  });

  it("met à jour chaque règle indépendamment", () => {
    const short = passwordRequirements("Abc1");
    expect(short.find((r) => r.id === "length")?.met).toBe(false);
    expect(short.find((r) => r.id === "uppercase")?.met).toBe(true);
    expect(short.find((r) => r.id === "lowercase")?.met).toBe(true);
    expect(short.find((r) => r.id === "digit")?.met).toBe(true);

    const valid = passwordRequirements("Abcdef12");
    expect(valid.every((requirement) => requirement.met)).toBe(true);
  });
});

describe("validatePassword", () => {
  it("exige un mot de passe", () => {
    expect(validatePassword("")).toBe("Le mot de passe est requis.");
  });

  it("renvoie la première règle non remplie", () => {
    expect(validatePassword("abcdefg")).toBe("Au moins 8 caractères.");
    expect(validatePassword("abcdefgh")).toBe("Au moins une majuscule.");
    expect(validatePassword("ABCDEFGH")).toBe("Au moins une minuscule.");
    expect(validatePassword("Abcdefgh")).toBe("Au moins un chiffre.");
  });

  it("accepte un mot de passe conforme", () => {
    expect(validatePassword("Abcdef12")).toBeNull();
    expect(isPasswordValid("Abcdef12")).toBe(true);
  });
});
