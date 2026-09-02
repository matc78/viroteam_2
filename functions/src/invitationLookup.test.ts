import test from "node:test";
import assert from "node:assert/strict";
import {
  isExpired,
  maskEmail,
  parseLookupCodeArgs,
  toIsoOrNull,
} from "./invitationLookupUtils";

test("maskEmail garde la 1re lettre et le domaine", () => {
  assert.equal(maskEmail("matia@gmail.com"), "m•••@gmail.com");
  assert.equal(maskEmail("  Jean.Dupont@Club.FR "), "j•••@club.fr");
  assert.equal(maskEmail("a@b.c"), "a•••@b.c");
});

test("maskEmail ne renvoie jamais la partie locale complète", () => {
  const hint = maskEmail("tristan.heraud@example.org");
  assert.ok(hint);
  assert.ok(!hint.includes("tristan"));
  assert.ok(!hint.includes("heraud"));
});

test("maskEmail retourne null si e-mail absent ou invalide", () => {
  assert.equal(maskEmail(undefined), null);
  assert.equal(maskEmail(""), null);
  assert.equal(maskEmail("sans-arobase"), null);
  assert.equal(maskEmail("@domaine.fr"), null);
  assert.equal(maskEmail("local@"), null);
  assert.equal(maskEmail(42), null);
});

test("parseLookupCodeArgs trim + upper", () => {
  assert.deepEqual(parseLookupCodeArgs({ code: " ab7k9x " }), { code: "AB7K9X" });
});

test("parseLookupCodeArgs refuse code manquant, trop court ou invalide", () => {
  const isInvalidArgument = (error: unknown) =>
    error instanceof Error && (error as { code?: string }).code === "invalid-argument";
  assert.throws(() => parseLookupCodeArgs({}), isInvalidArgument);
  assert.throws(() => parseLookupCodeArgs(null), isInvalidArgument);
  assert.throws(() => parseLookupCodeArgs({ code: "ab" }), isInvalidArgument);
  assert.throws(() => parseLookupCodeArgs({ code: "AB CD EF" }), isInvalidArgument);
  assert.throws(() => parseLookupCodeArgs({ code: 123456 }), isInvalidArgument);
  assert.throws(
    () => parseLookupCodeArgs({ code: "A".repeat(40) }),
    isInvalidArgument,
  );
});

test("toIsoOrNull accepte Date et objets Timestamp-like", () => {
  const date = new Date("2026-09-02T10:00:00.000Z");
  assert.equal(toIsoOrNull(date), "2026-09-02T10:00:00.000Z");
  assert.equal(toIsoOrNull({ toDate: () => date }), "2026-09-02T10:00:00.000Z");
  assert.equal(toIsoOrNull(null), null);
  assert.equal(toIsoOrNull("2026"), null);
});

test("isExpired compare à l'instant fourni", () => {
  const now = new Date("2026-09-02T10:00:00.000Z").getTime();
  assert.equal(isExpired(new Date(now - 1000), now), true);
  assert.equal(isExpired(new Date(now + 1000), now), false);
  assert.equal(isExpired(null, now), false);
});
