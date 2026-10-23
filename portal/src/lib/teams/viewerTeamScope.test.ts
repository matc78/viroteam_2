import { describe, expect, it } from "vitest";
import {
  eventVisibleToPlayer,
  isExcludedFromEvent,
  memberMatchIds,
} from "./viewerTeamScope";

describe("visibilité d’un événement pour un joueur retiré des convoqués", () => {
  const event = {
    teamIds: ["team1"],
    teamMemberIds: ["uid-b"],
    excludedMemberIds: ["mem-a"],
  };

  it("masque l’événement même si une de ses équipes est visée", () => {
    const matchIds = memberMatchIds({ memberId: "mem-a", accountUid: "uid-a" });
    expect(isExcludedFromEvent(event, matchIds)).toBe(true);
    expect(
      eventVisibleToPlayer({
        event,
        viewerTeamIds: new Set(["team1"]),
        playerMatchIds: matchIds,
      }),
    ).toBe(false);
  });

  it("matche l’exclu via son accountUid", () => {
    const matchIds = memberMatchIds({ memberId: "mem-x", accountUid: "mem-a" });
    expect(isExcludedFromEvent(event, matchIds)).toBe(true);
  });

  it("laisse visible l’événement aux autres joueurs de l’équipe", () => {
    expect(
      eventVisibleToPlayer({
        event,
        viewerTeamIds: new Set(["team1"]),
        playerMatchIds: memberMatchIds({ memberId: "mem-c" }),
      }),
    ).toBe(true);
  });
});
