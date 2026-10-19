import { describe, expect, it } from "vitest";
import { resolveGuestAudience } from "./resolveGuestAudience";

describe("resolveGuestAudience", () => {
  it("n’écrit qu’un id canonique par personne (pas tous les matchIds)", () => {
    const result = resolveGuestAudience(
      [{ kind: "person", id: "mem-a" }],
      [],
      [
        {
          id: "mem-a",
          matchIds: ["mem-a", "uid-a"],
          name: "Alix",
          role: "player",
          avatarUrl: null,
        },
      ],
    );
    expect(result.teamMemberIds).toEqual(["uid-a"]);
  });

  it("utilise le memberId si le compte n’est pas lié", () => {
    const result = resolveGuestAudience(
      [{ kind: "person", id: "mem-b" }],
      [],
      [
        {
          id: "mem-b",
          matchIds: ["mem-b"],
          name: "Matia",
          role: "player",
          avatarUrl: null,
        },
      ],
    );
    expect(result.teamMemberIds).toEqual(["mem-b"]);
  });
});
