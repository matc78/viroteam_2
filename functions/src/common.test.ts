import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpsError } from "firebase-functions/v2/https";
import { EMAIL_NOT_VERIFIED_REASON, requireVerifiedEmail } from "./common";

describe("requireVerifiedEmail", () => {
  it("laisse passer un e-mail confirmé", () => {
    assert.doesNotThrow(() =>
      requireVerifiedEmail({ auth: { token: { email_verified: true } } }),
    );
  });

  it("refuse un e-mail non confirmé avec la raison attendue", () => {
    for (const token of [{ email_verified: false }, {}]) {
      assert.throws(
        () => requireVerifiedEmail({ auth: { token } }),
        (error: unknown) =>
          error instanceof HttpsError &&
          error.code === "failed-precondition" &&
          (error.details as { reason?: string }).reason === EMAIL_NOT_VERIFIED_REASON,
      );
    }
  });
});
