import { describe, expect, it } from "vitest";
import { audienceForActiveClub, isLoadedForScope } from "./familyScope";

describe("isLoadedForScope", () => {
  it("accepte seulement le même club et le même membre", () => {
    const loaded = { clubId: "c1", memberId: "kid1" };
    expect(isLoadedForScope(loaded, { clubId: "c1", memberId: "kid1" })).toBe(
      true,
    );
    // Changement d’enfant pendant le rechargement.
    expect(isLoadedForScope(loaded, { clubId: "c1", memberId: "kid2" })).toBe(
      false,
    );
    // Changement de club.
    expect(isLoadedForScope(loaded, { clubId: "c2", memberId: "kid1" })).toBe(
      false,
    );
  });

  it("refuse l’absence de données", () => {
    expect(isLoadedForScope(null, { clubId: "c1", memberId: null })).toBe(
      false,
    );
  });
});

describe("audienceForActiveClub", () => {
  const resolution = {
    clubId: "c1",
    targets: ["kid1"],
    selectedMemberId: "kid1",
  };

  it("expose la sélection du club résolu", () => {
    expect(audienceForActiveClub(resolution, "c1")).toEqual({
      targets: ["kid1"],
      selectedMemberId: "kid1",
      pending: false,
    });
  });

  it("n’expose jamais l’ancien enfant pendant la résolution d’un autre club", () => {
    expect(audienceForActiveClub(resolution, "c2")).toEqual({
      targets: [],
      selectedMemberId: null,
      pending: true,
    });
  });
});
