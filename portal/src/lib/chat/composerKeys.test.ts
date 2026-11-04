import { describe, expect, it } from "vitest";
import {
  hasSendableText,
  isImeComposing,
  shouldSubmitOnEnter,
} from "./composerKeys";

describe("composerKeys", () => {
  it("Entrée seule valide", () => {
    expect(shouldSubmitOnEnter({ key: "Enter", shiftKey: false })).toBe(true);
  });

  it("Maj+Entrée saute une ligne", () => {
    expect(shouldSubmitOnEnter({ key: "Enter", shiftKey: true })).toBe(false);
  });

  it("autre touche → rien", () => {
    expect(shouldSubmitOnEnter({ key: "a", shiftKey: false })).toBe(false);
  });

  it("composition IME (isComposing ou keyCode 229) → n’envoie pas", () => {
    expect(
      shouldSubmitOnEnter({ key: "Enter", shiftKey: false, isComposing: true }),
    ).toBe(false);
    expect(
      shouldSubmitOnEnter({ key: "Enter", shiftKey: false, keyCode: 229 }),
    ).toBe(false);
    expect(isImeComposing({ key: "Enter", shiftKey: false, keyCode: 13 })).toBe(
      false,
    );
  });

  it("brouillon vide ou fait d’espaces → rien à envoyer", () => {
    expect(hasSendableText("")).toBe(false);
    expect(hasSendableText("  \n\t ")).toBe(false);
    expect(hasSendableText(" ok ")).toBe(true);
  });
});
