import { describe, expect, it } from "vitest";
import { lockScroll } from "./scrollLock";

function fakeRoot(clientWidth = 1000) {
  return {
    style: { overflow: "", paddingRight: "", scrollbarGutter: "" },
    clientWidth,
  };
}

describe("lockScroll", () => {
  it("bloque la page et compense la barre de défilement", () => {
    const root = fakeRoot(1000);
    const release = lockScroll(root, 1015);
    expect(root.style.overflow).toBe("hidden");
    expect(root.style.paddingRight).toBe("15px");
    release();
    expect(root.style.overflow).toBe("");
    expect(root.style.paddingRight).toBe("");
  });

  it("ne débloque qu’à la fermeture de la dernière modale empilée", () => {
    const root = fakeRoot();
    root.style.overflow = "auto";
    const first = lockScroll(root, 1000);
    const second = lockScroll(root, 1000);
    first();
    expect(root.style.overflow).toBe("hidden");
    first();
    expect(root.style.overflow).toBe("hidden");
    second();
    expect(root.style.overflow).toBe("auto");
    expect(root.style.paddingRight).toBe("");
  });

  it("garde la gouttière quand le navigateur gère scrollbar-gutter", () => {
    const root = fakeRoot(1000);
    root.style.paddingRight = "8px";
    const release = lockScroll(root, 1015, { stableGutter: true });
    expect(root.style.scrollbarGutter).toBe("stable");
    expect(root.style.paddingRight).toBe("8px");
    release();
    expect(root.style.scrollbarGutter).toBe("");
    expect(root.style.overflow).toBe("");
  });

  it("se reverrouille après libération (double effet de StrictMode)", () => {
    const root = fakeRoot(1000);
    lockScroll(root, 1015)();
    const again = lockScroll(root, 1015);
    expect(root.style.overflow).toBe("hidden");
    expect(root.style.paddingRight).toBe("15px");
    again();
    expect(root.style.paddingRight).toBe("");
  });
});
