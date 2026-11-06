import { describe, expect, it } from "vitest";
import type { TeamOption } from "@/lib/firebase/eventService";
import {
  eventVisibleToPlayer,
  isExcludedFromEvent,
  rosterTeamsForViewer,
  viewerTeamIdsForRole,
} from "./viewerTeamScope";

describe("visibilité d’un événement pour un joueur retiré des convoqués", () => {
  const event = {
    teamIds: ["team1"],
    teamMemberIds: ["uid-b"],
    excludedMemberIds: ["uid-a"],
  };

  it("masque l’événement même si une de ses équipes est visée", () => {
    expect(isExcludedFromEvent(event, "uid-a")).toBe(true);
    expect(
      eventVisibleToPlayer({
        event,
        viewerTeamIds: new Set(["team1"]),
        memberId: "uid-a",
      }),
    ).toBe(false);
  });

  it("laisse visible l’événement aux autres joueurs de l’équipe", () => {
    expect(
      eventVisibleToPlayer({
        event,
        viewerTeamIds: new Set(["team1"]),
        memberId: "mem-c",
      }),
    ).toBe(true);
  });

  it("montre une convocation personnelle hors équipe", () => {
    expect(
      eventVisibleToPlayer({
        event,
        viewerTeamIds: new Set(),
        memberId: "uid-b",
      }),
    ).toBe(true);
  });

  it("sans fiche, aucun id ne matche", () => {
    expect(isExcludedFromEvent(event, null)).toBe(false);
    expect(
      eventVisibleToPlayer({ event, viewerTeamIds: new Set(), memberId: null }),
    ).toBe(false);
  });
});

describe("équipes du viewer", () => {
  const teams = [
    { id: "t1", coachIds: ["uid-a"], playerIds: [] },
    { id: "t2", coachIds: [], playerIds: ["uid-a"] },
    { id: "t3", coachIds: [], playerIds: ["uid-b"] },
  ] as unknown as TeamOption[];

  it("coach : union des rosters coach et joueur", () => {
    expect(rosterTeamsForViewer(teams, "uid-a").map((team) => team.id)).toEqual([
      "t1",
      "t2",
    ]);
    expect(
      viewerTeamIdsForRole({ role: "coach", teams, memberId: "uid-a" }),
    ).toEqual(["t1", "t2"]);
  });

  it("joueur : seulement les équipes où il joue", () => {
    expect(
      viewerTeamIdsForRole({ role: "player", teams, memberId: "uid-a" }),
    ).toEqual(["t2"]);
  });

  it("admin : toutes les équipes", () => {
    expect(
      viewerTeamIdsForRole({ role: "admin", teams, memberId: null }),
    ).toEqual(["t1", "t2", "t3"]);
  });
});
