import { describe, expect, it } from "vitest";
import { passwordResetErrorMessage } from "./authErrors";

describe("passwordResetErrorMessage", () => {
  it("user-not-found → null (succès neutre)", () => {
    expect(
      passwordResetErrorMessage({ code: "auth/user-not-found" }),
    ).toBeNull();
    expect(passwordResetErrorMessage({ code: "user-not-found" })).toBeNull();
  });

  it("mappe les erreurs réseau et rate-limit", () => {
    expect(
      passwordResetErrorMessage({ code: "auth/network-request-failed" }),
    ).toBe("Problème réseau. Vérifie ta connexion.");
    expect(
      passwordResetErrorMessage({ code: "auth/too-many-requests" }),
    ).toBe("Trop de tentatives. Réessaie plus tard.");
  });

  it("mappe e-mail invalide et compte désactivé", () => {
    expect(passwordResetErrorMessage({ code: "auth/invalid-email" })).toBe(
      "Adresse e-mail invalide.",
    );
    expect(passwordResetErrorMessage({ code: "auth/user-disabled" })).toBe(
      "Ce compte est désactivé.",
    );
  });

  it("renvoie un message générique pour un code inconnu", () => {
    expect(passwordResetErrorMessage({ code: "auth/internal-error" })).toBe(
      "Envoi du lien impossible. Réessaie dans un instant.",
    );
  });
});
