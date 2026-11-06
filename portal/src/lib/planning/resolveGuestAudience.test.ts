import { describe, expect, it } from "vitest";
import { resolveGuestAudience } from "./resolveGuestAudience";

describe("resolveGuestAudience", () => {
  it("convoque une personne par son id de fiche (= uid si liée)", () => {
    const result = resolveGuestAudience(
      [
        { kind: "person", id: "uid-a" },
        { kind: "person", id: "mem-b" },
      ],
      [],
      [
        { id: "uid-a", name: "Alix", role: "player", avatarUrl: null },
        { id: "mem-b", name: "Matia", role: "player", avatarUrl: null },
      ],
    );
    expect(result.teamMemberIds).toEqual(["uid-a", "mem-b"]);
  });

  it("« Tout le club » convoque chaque équipe et chaque membre", () => {
    const result = resolveGuestAudience(
      [{ kind: "club", id: "all" }],
      [
        {
          id: "team-1",
          name: "U13",
          category: "U13",
          playerIds: ["uid-a"],
          coachIds: [],
        },
      ],
      [
        { id: "uid-a", name: "Alix", role: "player", avatarUrl: null },
        { id: "mem-c", name: "Sans équipe", role: "admin", avatarUrl: null },
      ],
    );
    expect(result.allTeams).toBe(true);
    expect(result.teamIds).toEqual(["team-1"]);
    expect(result.teamMemberIds.sort()).toEqual(["mem-c", "uid-a"]);
  });

  it("sans « Tout le club », allTeams reste faux", () => {
    const result = resolveGuestAudience([], [], []);
    expect(result).toEqual({ teamIds: [], teamMemberIds: [], allTeams: false });
  });
});
