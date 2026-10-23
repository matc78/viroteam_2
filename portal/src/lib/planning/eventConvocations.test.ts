import { describe, expect, it } from "vitest";
import type { TeamOption } from "@/lib/firebase/eventService";
import { buildGuestDirectoryFromPeople } from "./eventGuestRows";
import {
  buildConvocationRows,
  canManageEventConvocations,
  computeConvocationDeltas,
} from "./eventConvocations";

const teams: TeamOption[] = [
  {
    id: "team1",
    name: "Séniors",
    category: "",
    playerIds: ["mem-a", "uid-b", "mem-c"],
    coachIds: ["uid-coach"],
  },
];

const directory = buildGuestDirectoryFromPeople([
  { id: "mem-a", matchIds: ["mem-a", "uid-a"], name: "Alix", role: "player", avatarUrl: null },
  { id: "mem-b", matchIds: ["mem-b", "uid-b"], name: "Basile", role: "player", avatarUrl: null },
  { id: "mem-c", matchIds: ["mem-c"], name: "Chloé", role: "player", avatarUrl: null },
]);

describe("buildConvocationRows", () => {
  it("coche les convoqués, décoche les exclus (via alias), trie par nom", () => {
    const rows = buildConvocationRows({
      event: {
        teamIds: ["team1"],
        teamMemberIds: ["uid-a", "mem-c"],
        excludedMemberIds: ["mem-b"],
      },
      teams,
      directory,
    });
    expect(rows.map((row) => [row.name, row.convoked, row.audienceId])).toEqual([
      ["Alix", true, "uid-a"],
      ["Basile", false, "mem-b"],
      ["Chloé", true, "mem-c"],
    ]);
  });

  it("considère convoqué un joueur du roster pas encore synchronisé", () => {
    const rows = buildConvocationRows({
      event: { teamIds: ["team1"], teamMemberIds: [], excludedMemberIds: [] },
      teams,
      directory,
    });
    expect(rows.every((row) => row.convoked)).toBe(true);
    expect(rows).toHaveLength(3);
  });
});

describe("computeConvocationDeltas", () => {
  it("retourne les retraits et réintégrations par rapport à l’état initial", () => {
    const rows = buildConvocationRows({
      event: {
        teamIds: ["team1"],
        teamMemberIds: ["uid-a", "mem-c"],
        excludedMemberIds: ["mem-b"],
      },
      teams,
      directory,
    });
    // Alix décochée, Basile recoché, Chloé inchangée.
    const deltas = computeConvocationDeltas(rows, new Set(["uid-b", "mem-c"]));
    expect(deltas).toEqual({ excludeIds: ["uid-a"], reintegrateIds: ["mem-b"] });
  });
});

describe("canManageEventConvocations", () => {
  const clock = new Date("2026-10-23T12:00:00Z");
  it("refuse un événement passé ou sans équipe", () => {
    expect(
      canManageEventConvocations({ teamIds: ["t"], startsAt: "2026-10-22T18:00:00Z" }, clock),
    ).toBe(false);
    expect(
      canManageEventConvocations({ teamIds: [], startsAt: "2026-10-24T18:00:00Z" }, clock),
    ).toBe(false);
    expect(
      canManageEventConvocations({ teamIds: ["t"], startsAt: "2026-10-24T18:00:00Z" }, clock),
    ).toBe(true);
  });
});
