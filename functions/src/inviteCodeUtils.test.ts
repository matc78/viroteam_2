import test from "node:test";
import assert from "node:assert/strict";
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  generateInviteCode,
  generateUniqueInviteCode,
} from "./inviteCodeUtils";

test("generateInviteCode tire dans l’alphabet sans ambiguïté", () => {
  const code = generateInviteCode();
  assert.equal(code.length, INVITE_CODE_LENGTH);
  for (const char of code) assert.ok(INVITE_CODE_ALPHABET.includes(char), char);
  assert.equal(generateInviteCode(3, () => 0), "AAA");
});

test("generateUniqueInviteCode retire en cas de collision", async () => {
  const drawn = ["AAAAAA", "BBBBBB", "CCCCCC"];
  const taken = new Set(["AAAAAA", "BBBBBB"]);
  const code = await generateUniqueInviteCode({
    generate: () => drawn.shift()!,
    isTaken: async (candidate) => taken.has(candidate),
  });
  assert.equal(code, "CCCCCC");
});

test("generateUniqueInviteCode abandonne après trop de collisions", async () => {
  await assert.rejects(
    generateUniqueInviteCode({
      generate: () => "AAAAAA",
      isTaken: async () => true,
      maxAttempts: 3,
    }),
  );
});
