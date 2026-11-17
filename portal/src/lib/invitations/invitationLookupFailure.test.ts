import { describe, expect, it } from "vitest";
import { joinCopy } from "@/lib/copy/joinCopy";
import {
  lookupFailureCopy,
  lookupFailureFromResult,
} from "./invitationLookupFailure";

describe("lookupFailureFromResult", () => {
  it("distingue expiré, épuisé et introuvable", () => {
    expect(lookupFailureFromResult({ found: false, reason: "expired" })).toBe(
      "expired",
    );
    expect(
      lookupFailureFromResult({ found: false, reason: "exhausted" }),
    ).toBe("exhausted");
    expect(lookupFailureFromResult({ found: false })).toBe("notFound");
  });
});

describe("lookupFailureCopy", () => {
  it("donne un texte propre à chaque cause", () => {
    expect(lookupFailureCopy("expired").title).toBe(joinCopy.lookupExpiredTitle);
    expect(lookupFailureCopy("exhausted").title).toBe(
      joinCopy.lookupExhaustedTitle,
    );
    expect(lookupFailureCopy("error").title).toBe(joinCopy.lookupErrorTitle);
    expect(lookupFailureCopy("notFound").title).toBe(
      joinCopy.lookupNotFoundTitle,
    );
  });
});
