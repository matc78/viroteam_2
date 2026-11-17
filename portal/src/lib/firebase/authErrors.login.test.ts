import { describe, expect, it } from "vitest";
import { authErrorMessage, toAuthActionError } from "./authErrors";

describe("authErrorMessage — connexion e-mail / mot de passe", () => {
  it("mappe invalid-credential, wrong-password et user-not-found", () => {
    const message = "E-mail ou mot de passe incorrect.";
    expect(authErrorMessage({ code: "auth/invalid-credential" })).toBe(message);
    expect(authErrorMessage({ code: "auth/wrong-password" })).toBe(message);
    expect(authErrorMessage({ code: "auth/user-not-found" })).toBe(message);
  });

  it("toAuthActionError conserve le code Firebase", () => {
    const error = toAuthActionError({ code: "auth/invalid-credential" });
    expect(error.message).toBe("E-mail ou mot de passe incorrect.");
    expect(error.code).toBe("auth/invalid-credential");
  });
});
