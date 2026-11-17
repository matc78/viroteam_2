import { describe, expect, it } from "vitest";
import { missingAudienceIds } from "./audienceSync";

describe("missingAudienceIds", () => {
  it("ajoute les joueurs du roster absents, sans doublon", () => {
    expect(
      missingAudienceIds({
        currentMemberIds: ["uid-a"],
        expectedMemberIds: ["uid-a", "uid-b", "uid-b"],
      }),
    ).toEqual(["uid-b"]);
  });

  it("ne réintègre jamais un joueur retiré des convoqués", () => {
    expect(
      missingAudienceIds({
        currentMemberIds: [],
        expectedMemberIds: ["uid-a", "uid-b"],
        excludedMemberIds: ["uid-a"],
      }),
    ).toEqual(["uid-b"]);
  });

  it("rien à ajouter quand l’audience couvre déjà le roster", () => {
    expect(
      missingAudienceIds({
        currentMemberIds: ["uid-a", "invite-manuel"],
        expectedMemberIds: ["uid-a"],
      }),
    ).toEqual([]);
  });
});
