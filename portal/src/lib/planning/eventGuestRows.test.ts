import { describe, expect, it } from "vitest";
import type { ClubEventView, TeamOption } from "@/lib/firebase/eventService";
import {
  buildEventGuestRows,
  buildGuestDirectoryFromMembers,
  buildGuestDirectoryFromPeople,
  isSpecialEvent,
} from "./eventGuestRows";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";

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
    { id: "uid-alix", name: "Alix MOREAU", badge: "player", avatarUrl: null },
    { id: "uid-matia", name: "Matia CILLY", badge: "player", avatarUrl: null },
    { id: "uid-paul", name: "Paul DEL PERUGIA", badge: "coach", avatarUrl: null },
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
        sparringIds: [],
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
    expect(rows[0]?.badge).toBeNull();
  });
});

describe("badges des RSVP", () => {
  const teams: TeamOption[] = [
    {
      id: "team1",
      name: "Séniors",
      category: "Sénior",
      playerIds: ["uid-alix"],
      coachIds: ["uid-paul", "uid-admin-coach"],
      sparringIds: [],
    },
  ];
  const directory = buildGuestDirectoryFromPeople([
    { id: "uid-alix", name: "Alix", badge: "player", avatarUrl: null },
    { id: "uid-paul", name: "Paul", badge: "coach", avatarUrl: null },
    { id: "uid-admin-coach", name: "Zoé", badge: "admin", avatarUrl: null },
    { id: "uid-admin", name: "Bob", badge: "admin", avatarUrl: null },
  ]);
  const badgeByName = (rows: ReturnType<typeof buildEventGuestRows>) =>
    Object.fromEntries(rows.map((row) => [row.name, row.badge]));

  it("événement d’équipe : Entraîneur pour les coachs, jamais Admin", () => {
    const rows = buildEventGuestRows({
      event: makeEvent({ teamMemberIds: ["uid-alix", "uid-admin"] }),
      teams,
      directory,
    });
    expect(badgeByName(rows)).toEqual({
      Paul: "coach",
      Zoé: "coach",
      Alix: null,
      Bob: null,
    });
  });

  it("événement spécial : Admin si droit admin, sinon comme une équipe", () => {
    const rows = buildEventGuestRows({
      event: makeEvent({
        teamIds: ["team1"],
        allTeams: true,
        teamMemberIds: ["uid-alix", "uid-admin"],
      }),
      teams,
      directory,
    });
    expect(badgeByName(rows)).toEqual({
      Paul: "coach",
      Zoé: "admin",
      Alix: null,
      Bob: "admin",
    });
  });

  it("événement sans équipe = spécial", () => {
    expect(isSpecialEvent({ teamIds: [], allTeams: false })).toBe(true);
    expect(isSpecialEvent({ teamIds: ["team1"] })).toBe(false);
    const rows = buildEventGuestRows({
      event: makeEvent({ teamIds: [], teamMemberIds: ["uid-admin", "uid-alix"] }),
      teams,
      directory,
    });
    expect(badgeByName(rows)).toEqual({ Bob: "admin", Alix: null });
  });

  it("annuaire depuis les fiches : droit admin lu sur la fiche", () => {
    const member = {
      memberId: "m1",
      displayName: "Claire",
      avatarUrl: null,
      permissions: ["admin"],
    } as unknown as ClubMemberRecord;
    expect(buildGuestDirectoryFromMembers([member]).m1).toEqual({
      name: "Claire",
      avatarUrl: null,
      isAdmin: true,
    });
  });
});
