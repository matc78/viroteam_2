import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declaredClubIds, sameClubIds } from "./userClubIdsUtils";

describe("declaredClubIds", () => {
  it("extrait les clubId non vides, dédupliqués et triés", () => {
    assert.deepEqual(
      declaredClubIds([
        { clubId: "b", role: "player" },
        { clubId: "a", role: "admin" },
        { clubId: "b", role: "coach" },
        { clubId: " " },
        null,
        "x",
      ]),
      ["a", "b"],
    );
  });

  it("valeur absente ou invalide → liste vide", () => {
    assert.deepEqual(declaredClubIds(undefined), []);
    assert.deepEqual(declaredClubIds({ clubId: "a" }), []);
  });
});

describe("sameClubIds", () => {
  it("compare sans tenir compte de l'ordre", () => {
    assert.equal(sameClubIds(["b", "a"], ["a", "b"]), true);
    assert.equal(sameClubIds(["a"], ["a", "b"]), false);
  });

  it("champ absent → différent (à écrire)", () => {
    assert.equal(sameClubIds(undefined, []), false);
  });
});
