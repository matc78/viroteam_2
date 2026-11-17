import { describe, expect, it } from "vitest";
import { nextMenuIndex } from "./menuNavigation";

describe("nextMenuIndex", () => {
  it("descend et boucle en fin de menu", () => {
    expect(nextMenuIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextMenuIndex("ArrowDown", 2, 3)).toBe(0);
  });

  it("remonte et boucle en début de menu", () => {
    expect(nextMenuIndex("ArrowUp", 1, 3)).toBe(0);
    expect(nextMenuIndex("ArrowUp", 0, 3)).toBe(2);
  });

  it("part du premier ou du dernier item sans focus courant", () => {
    expect(nextMenuIndex("ArrowDown", -1, 3)).toBe(0);
    expect(nextMenuIndex("ArrowUp", -1, 3)).toBe(2);
  });

  it("gère Début / Fin", () => {
    expect(nextMenuIndex("Home", 2, 3)).toBe(0);
    expect(nextMenuIndex("End", 0, 3)).toBe(2);
  });

  it("ignore les autres touches et les menus vides", () => {
    expect(nextMenuIndex("Enter", 0, 3)).toBeNull();
    expect(nextMenuIndex("ArrowDown", -1, 0)).toBeNull();
  });
});
