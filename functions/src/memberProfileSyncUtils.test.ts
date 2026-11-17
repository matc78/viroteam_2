import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memberProfileSyncPatch } from "./memberProfileSyncUtils";

describe("memberProfileSyncPatch", () => {
  it("recopie un nom corrigé (cas COCK → COCQ)", () => {
    assert.deepEqual(
      memberProfileSyncPatch(
        { firstName: "Louka", lastName: "COCQ", displayName: "Louka COCQ" },
        {
          firstName: "Louka",
          lastName: "COCK",
          snapshot: { displayName: "Louka COCK", email: "l@x.fr" },
        },
      ),
      { lastName: "COCQ", "snapshot.displayName": "Louka COCQ" },
    );
  });

  it("recopie la photo sans toucher au reste du snapshot", () => {
    assert.deepEqual(
      memberProfileSyncPatch(
        { firstName: "A", lastName: "B", displayName: "A B", avatarUrl: "https://x/a.png" },
        { firstName: "A", lastName: "B", snapshot: { displayName: "A B" } },
      ),
      { "snapshot.avatarUrl": "https://x/a.png" },
    );
  });

  it("fiche à jour → null ; profil vide ne vide pas la fiche", () => {
    const member = { firstName: "A", lastName: "B", snapshot: { displayName: "A B" } };
    assert.equal(
      memberProfileSyncPatch({ firstName: "A", lastName: "B", displayName: "A B" }, member),
      null,
    );
    assert.equal(memberProfileSyncPatch({}, member), null);
  });
});
