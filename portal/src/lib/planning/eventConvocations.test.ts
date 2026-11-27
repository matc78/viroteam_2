import { describe, expect, it } from "vitest";
import type { TeamOption } from "@/lib/firebase/eventService";
import { buildGuestDirectoryFromPeople } from "./eventGuestRows";
import {
  buildConvocationRows,
  canManageEventConvocations,
  computeConvocationDeltas,
  defaultExcludedPlayerIds,
} from "./eventConvocations";

const teams: TeamOption[] = [
  {
    id: "team1",
    name: "Séniors",
    category: "",
    playerIds: ["uid-a", "uid-b", "mem-c"],
    coachIds: ["uid-coach"],
    sparringIds: [],
  },
];

const directory = buildGuestDirectoryFromPeople([
  { id: "uid-a", name: "Alix", badge: "player", avatarUrl: null },
  { id: "uid-b", name: "Basile", badge: "player", avatarUrl: null },
  { id: "mem-c", name: "Chloé", badge: "player", avatarUrl: null },
]);

describe("buildConvocationRows", () => {
  it("coche les convoqués, décoche les exclus, trie par nom", () => {
    const rows = buildConvocationRows({
      event: {
        teamIds: ["team1"],
        teamMemberIds: ["uid-a", "mem-c"],
        excludedMemberIds: ["uid-b"],
      },
      teams,
      directory,
    });
    expect(rows.map((row) => [row.name, row.convoked, row.audienceId])).toEqual([
      ["Alix", true, "uid-a"],
      ["Basile", false, "uid-b"],
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
        excludedMemberIds: ["uid-b"],
      },
      teams,
      directory,
    });
    // Alix décochée, Basile recoché, Chloé inchangée.
    const deltas = computeConvocationDeltas(rows, new Set(["uid-b", "mem-c"]));
    expect(deltas).toEqual({ excludeIds: ["uid-a"], reintegrateIds: ["uid-b"] });
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

describe("sparrings", () => {
  const sparringTeam: TeamOption = {
    id: "team1",
    name: "Séniors",
    category: "",
    playerIds: ["uid-a", "uid-s"],
    coachIds: [],
    sparringIds: ["uid-s"],
  };

  it("décoche par défaut les sparrings d’un match seulement", () => {
    expect(defaultExcludedPlayerIds("match", sparringTeam)).toEqual(new Set(["uid-s"]));
    expect(defaultExcludedPlayerIds("training", sparringTeam)).toEqual(new Set());
    expect(defaultExcludedPlayerIds("match", null)).toEqual(new Set());
  });

  it("marque les lignes des sparrings", () => {
    const rows = buildConvocationRows({
      event: { teamIds: ["team1"], teamMemberIds: ["uid-a"], excludedMemberIds: ["uid-s"] },
      teams: [sparringTeam],
      directory: {},
    });
    expect(rows.find((row) => row.key === "uid-s")).toMatchObject({
      sparring: true,
      convoked: false,
    });
    expect(rows.find((row) => row.key === "uid-a")?.sparring).toBe(false);
  });
});
