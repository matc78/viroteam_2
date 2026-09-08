import { describe, expect, it } from "vitest";
import {
  addressLineError,
  cityError,
  firstNameError,
  formatCity,
  formatFirstName,
  formatLastName,
  formatLicense,
  formatPostalCode,
  lastNameError,
  licenseError,
  postalCodeError,
} from "./personDataFormat";

describe("personDataFormat", () => {
  it("capitalise prénoms composés", () => {
    expect(formatFirstName("jean-pierre")).toBe("Jean-Pierre");
    expect(formatFirstName("marie claire")).toBe("Marie Claire");
    expect(formatFirstName("o'connor")).toBe("O'Connor");
  });

  it("met le nom en majuscules", () => {
    expect(formatLastName("dupont")).toBe("DUPONT");
    expect(formatLastName("le blanc")).toBe("LE BLANC");
  });

  it("rejette emoji et caractères interdits dans les noms", () => {
    expect(firstNameError("Jean😀")).toContain("lettres");
    expect(lastNameError("Dupont123")).toContain("lettres");
    expect(() => formatFirstName("Jean!")).toThrow();
  });

  it("valide le code postal", () => {
    expect(postalCodeError("")).toBeNull();
    expect(formatPostalCode("75001")).toBe("75001");
    expect(postalCodeError("7500")).toContain("5 chiffres");
    expect(postalCodeError("7500a")).toContain("5 chiffres");
  });

  it("valide et formate la licence", () => {
    expect(licenseError("")).toBeNull();
    expect(formatLicense("ab12")).toBe("AB12");
    expect(licenseError("AB-12")).toContain("lettres et des chiffres");
  });

  it("valide adresse et ville", () => {
    expect(addressLineError("12 rue de la Paix")).toBeNull();
    expect(addressLineError("12 rue 😀")).toContain("emoji");
    expect(cityError("paris")).toBeNull();
    expect(formatCity("saint-étienne")).toBe("Saint-Étienne");
    expect(cityError("", { required: true })).toContain("obligatoire");
  });
});
