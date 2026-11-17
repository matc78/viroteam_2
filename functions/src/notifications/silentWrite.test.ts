import test from "node:test";
import assert from "node:assert/strict";
import { isSilentWrite } from "./silentWrite";

const at = (millis: number) => ({ toMillis: () => millis });

test("isSilentWrite : nouveau silentWriteAt = écriture technique", () => {
  assert.equal(isSilentWrite({}, { silentWriteAt: at(1) }), true);
  assert.equal(isSilentWrite({ silentWriteAt: at(1) }, { silentWriteAt: at(2) }), true);
});

test("isSilentWrite : un vote après une écriture technique notifie", () => {
  assert.equal(
    isSilentWrite({ silentWriteAt: at(1) }, { silentWriteAt: at(1), rsvp: { a: "yes" } }),
    false,
  );
  assert.equal(isSilentWrite({}, { rsvp: { a: "yes" } }), false);
});
