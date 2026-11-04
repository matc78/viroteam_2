import { describe, expect, it } from "vitest";
import {
  followSearchPosition,
  searchMatchAtPosition,
  stepSearchPosition,
} from "./threadSearchNavigation";

describe("stepSearchPosition", () => {
  it("aucun résultat → 0", () => {
    expect(stepSearchPosition(1, 0, "older")).toBe(0);
    expect(stepSearchPosition(0, 0, "newer")).toBe(0);
  });

  it("« older » remonte et boucle au plus récent", () => {
    expect(stepSearchPosition(1, 3, "older")).toBe(2);
    expect(stepSearchPosition(3, 3, "older")).toBe(1);
  });

  it("« newer » redescend et boucle au plus ancien", () => {
    expect(stepSearchPosition(2, 3, "newer")).toBe(1);
    expect(stepSearchPosition(1, 3, "newer")).toBe(3);
  });

  it("position hors limites ramenée dans [1, n]", () => {
    expect(stepSearchPosition(0, 3, "older")).toBe(2);
    expect(stepSearchPosition(9, 3, "newer")).toBe(2);
  });
});

describe("searchMatchAtPosition", () => {
  const matches = ["old", "mid", "new"];

  it("1 = plus récent, n = plus ancien", () => {
    expect(searchMatchAtPosition(matches, 1)).toBe("new");
    expect(searchMatchAtPosition(matches, 3)).toBe("old");
  });

  it("hors limites → null", () => {
    expect(searchMatchAtPosition(matches, 0)).toBeNull();
    expect(searchMatchAtPosition(matches, 4)).toBeNull();
    expect(searchMatchAtPosition([], 1)).toBeNull();
  });
});

describe("followSearchPosition", () => {
  it("suit le même message quand la liste change", () => {
    expect(followSearchPosition(["a", "b", "c", "d"], "b")).toBe(3);
  });

  it("message disparu ou aucun courant → plus récent", () => {
    expect(followSearchPosition(["a", "c"], "b")).toBe(1);
    expect(followSearchPosition(["a"], null)).toBe(1);
  });

  it("aucun résultat → 0", () => {
    expect(followSearchPosition([], "a")).toBe(0);
  });
});
