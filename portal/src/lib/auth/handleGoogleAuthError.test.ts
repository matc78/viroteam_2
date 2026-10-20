import { describe, expect, it } from "vitest";
import {
  EmailUsedWithPasswordError,
  GOOGLE_SIGN_IN_CANCELLED,
} from "@/lib/firebase/googleAuth";
import { handleGoogleAuthError } from "./handleGoogleAuthError";

describe("handleGoogleAuthError", () => {
  it("popup fermée : coupe le loader sans message d’erreur", () => {
    const result = handleGoogleAuthError(new Error(GOOGLE_SIGN_IN_CANCELLED));
    expect(result.shouldStopLoading).toBe(true);
    expect(result.formMessage).toBeUndefined();
  });

  it("compte mot de passe existant : message + e-mail à pré-remplir", () => {
    const result = handleGoogleAuthError(
      new EmailUsedWithPasswordError("a@club.fr"),
    );
    expect(result.shouldStopLoading).toBe(true);
    expect(result.emailToPrefill).toBe("a@club.fr");
    expect(result.formMessage).toBeTruthy();
  });

  it("erreur inconnue : message de repli", () => {
    const result = handleGoogleAuthError("boom", "Repli");
    expect(result).toEqual({ formMessage: "Repli", shouldStopLoading: true });
  });
});
