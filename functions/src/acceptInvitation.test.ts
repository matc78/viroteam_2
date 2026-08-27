import test from "node:test";
import assert from "node:assert/strict";
import { parseAcceptInvitationArgs } from "../lib/acceptInvitationArgs.js";

test("parseAcceptInvitationArgs exige clubId et invitationId", () => {
  assert.throws(() => parseAcceptInvitationArgs({}), (error: unknown) => {
    return (
      error instanceof Error &&
      error.message.includes("clubId et invitationId")
    );
  });
  assert.throws(
    () => parseAcceptInvitationArgs({ clubId: "c1" }),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes("clubId et invitationId"),
  );
});

test("parseAcceptInvitationArgs trim les valeurs", () => {
  const result = parseAcceptInvitationArgs({
    clubId: "  club-1  ",
    invitationId: " inv-2 ",
  });
  assert.equal(result.clubId, "club-1");
  assert.equal(result.invitationId, "inv-2");
});
