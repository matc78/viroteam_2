import { describe, expect, it } from "vitest";
import type {
  ClubEventView,
  PlanningGuestDirectoryEntry,
  TeamOption,
} from "@/lib/firebase/eventService";
import {
  buildEventGuestRows,
  buildGuestDirectoryFromPeople,
} from "./eventGuestRows";

function makeEvent(
  overrides: Partial<ClubEventView> & { teamMemberIds: string[] },
): ClubEventView {
  return {
    id: "ev1",
    title: "Entraînement",
    type: "training",
    startsAt: "2026-11-04T20:30:00.000Z",
    endsAt: "2026-11-04T22:30:00.000Z",
    dateId: "20261104",
    location: "Gymnase",
    teamIds: ["team1"],
    teamLabels: ["Séniors"],
    rsvpByMemberId: {},
    rsvpYes: 0,
    rsvpNo: 0,
    rsvpPending: 0,
    rsvpTotal: overrides.teamMemberIds.length,
    ...overrides,
  };
}

describe("buildEventGuestRows", () => {
  it("déduplique memberId + accountUid pour la même personne", () => {
    const directory = buildGuestDirectoryFromPeople([
      {
        id: "mem-alix",
        matchIds: ["mem-alix", "uid-alix"],
        name: "Alix MOREAU",
        role: "player",
        avatarUrl: null,
      },
      {
        id: "mem-matia",
        matchIds: ["mem-matia", "uid-matia"],
        name: "Matia CILLY",
        role: "player",
        avatarUrl: null,
      },
    ]);
    const teams: TeamOption[] = [
      {
        id: "team1",
        name: "Séniors",
        category: "Sénior",
        playerIds: ["uid-alix", "uid-matia"],
        coachIds: [],
      },
    ];
    const rows = buildEventGuestRows({
      event: makeEvent({
        teamMemberIds: ["mem-alix", "uid-alix", "mem-matia", "uid-matia"],
      }),
      teams,
      directory,
    });
    expect(rows.map((row) => row.name)).toEqual([
      "Alix MOREAU",
      "Matia CILLY",
    ]);
  });

  it("n’affiche qu’une fois un coach aussi présent dans teamMemberIds", () => {
    const paulEntry: PlanningGuestDirectoryEntry = {
      name: "Paul DEL PERUGIA",
      avatarUrl: null,
    };
    const directory: Record<string, PlanningGuestDirectoryEntry> = {
      "mem-paul": paulEntry,
      "uid-paul": paulEntry,
    };
    const teams: TeamOption[] = [
      {
        id: "team1",
        name: "Séniors",
        category: "Sénior",
        playerIds: ["uid-paul"],
        coachIds: ["uid-paul"],
      },
    ];
    const rows = buildEventGuestRows({
      event: makeEvent({
        teamMemberIds: ["mem-paul", "uid-paul"],
      }),
      teams,
      directory,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.isCoach).toBe(true);
    expect(rows[0]?.name).toBe("Paul DEL PERUGIA");
  });
});
