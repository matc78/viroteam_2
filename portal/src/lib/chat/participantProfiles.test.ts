import { describe, expect, it } from "vitest";
import {
  parseParticipantProfiles,
  splitParticipantsByProfiles,
} from "./participantProfiles";

describe("parseParticipantProfiles", () => {
  it("lit les profils et ignore les entrées invalides", () => {
    expect(
      parseParticipantProfiles({
        u1: { firstName: " Léa ", role: "coach", avatarUrl: "" },
        u2: "pas un objet",
        u3: { displayName: 42 },
      }),
    ).toEqual({
      u1: {
        firstName: "Léa",
        lastName: "",
        displayName: "",
        avatarUrl: null,
        role: "coach",
      },
      u3: {
        firstName: "",
        lastName: "",
        displayName: "",
        avatarUrl: null,
        role: "player",
      },
    });
  });

  it("valeur absente ou non objet → map vide", () => {
    expect(parseParticipantProfiles(undefined)).toEqual({});
    expect(parseParticipantProfiles(["u1"])).toEqual({});
  });
});

describe("splitParticipantsByProfiles", () => {
  it("sépare participants couverts et uids à résoudre (dédoublonnés)", () => {
    const { fromProfiles, missingUids } = splitParticipantsByProfiles({
      participantUids: ["u1", "u2", "u1", ""],
      profiles: {
        u1: {
          firstName: "Sam",
          lastName: "Lopez",
          displayName: "",
          avatarUrl: "https://example.com/sam.jpg",
          role: "parent",
        },
      },
    });
    expect(fromProfiles).toEqual([
      {
        uid: "u1",
        firstName: "Sam",
        displayName: "Sam Lopez",
        role: "parent",
        avatarUrl: "https://example.com/sam.jpg",
        hasLinkedAccount: true,
      },
    ]);
    expect(missingUids).toEqual(["u2"]);
  });
});
