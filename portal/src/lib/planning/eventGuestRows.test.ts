import { describe, expect, it } from "vitest";
import type { ClubEventView, TeamOption } from "@/lib/firebase/eventService";
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
    excludedMemberIds: [],
    seriesId: null,
    rsvpByMemberId: {},
    rsvpYes: 0,
    rsvpNo: 0,
    rsvpPending: 0,
    rsvpTotal: overrides.teamMemberIds.length,
    ...overrides,
  };
}

describe("buildEventGuestRows", () => {
  const directory = buildGuestDirectoryFromPeople([
    { id: "uid-alix", name: "Alix MOREAU", role: "player", avatarUrl: null },
    { id: "uid-matia", name: "Matia CILLY", role: "player", avatarUrl: null },
    { id: "uid-paul", name: "Paul DEL PERUGIA", role: "coach", avatarUrl: null },
  ]);

  it("liste les joueurs convoqués triés par nom, avec leur RSVP", () => {
    const rows = buildEventGuestRows({
      event: makeEvent({
        teamMemberIds: ["uid-matia", "uid-alix", "uid-matia"],
        rsvpByMemberId: { "uid-alix": "yes", "uid-matia": "maybe" },
      }),
      teams: [],
      directory,
    });
    expect(rows.map((row) => [row.name, row.status])).toEqual([
      ["Alix MOREAU", "yes"],
      ["Matia CILLY", "pending"],
    ]);
  });

  it("n’affiche qu’une fois un coach aussi présent dans teamMemberIds", () => {
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
      event: makeEvent({ teamMemberIds: ["uid-paul", "uid-alix"] }),
      teams,
      directory,
    });
    expect(rows.map((row) => [row.name, row.isCoach])).toEqual([
      ["Paul DEL PERUGIA", true],
      ["Alix MOREAU", false],
    ]);
  });

  it("affiche « Membre » pour un id absent de l’annuaire", () => {
    const rows = buildEventGuestRows({
      event: makeEvent({ teamMemberIds: ["mem-inconnu"] }),
      teams: [],
      directory,
    });
    expect(rows[0]?.name).toBe("Membre");
    expect(rows[0]?.audienceId).toBe("mem-inconnu");
  });
});
