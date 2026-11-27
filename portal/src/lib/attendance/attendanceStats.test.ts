import { describe, expect, it } from "vitest";
import {
  attendancePeriodStart,
  computeTeamAttendance,
  eventCounts,
  isLowResponder,
  presenceRate,
  responseRate,
  summarizeAttendance,
  type AttendanceEvent,
} from "./attendanceStats";

const now = new Date("2026-11-26T12:00:00");

function event(overrides: Partial<AttendanceEvent>): AttendanceEvent {
  return {
    id: "e",
    title: "Entraînement",
    type: "training",
    startsAt: "2026-11-20T18:00:00",
    teamIds: ["t1"],
    teamMemberIds: [],
    rsvpByMemberId: {},
    ...overrides,
  };
}

const team = { id: "t1", name: "M15", category: "M15", playerIds: ["a", "b", "c"] };
const names = new Map([
  ["a", "Alice"],
  ["b", "Bruno"],
  ["c", "Chloé"],
]);

describe("compteurs", () => {
  it("compte oui / peut-être / non / sans réponse", () => {
    const counts = eventCounts(
      event({
        teamMemberIds: ["a", "b", "c", "d"],
        rsvpByMemberId: { a: "yes", b: "no", c: "maybe" },
      }),
    );
    expect(counts).toEqual({ convoked: 4, yes: 1, maybe: 1, no: 1, none: 1 });
    expect(presenceRate(counts)).toBe(25);
    expect(responseRate(counts)).toBe(75);
    expect(presenceRate({ convoked: 0, yes: 0, maybe: 0, no: 0, none: 0 })).toBeNull();
  });

  it("limite aux membres demandés", () => {
    const counts = eventCounts(
      event({ teamMemberIds: ["a", "z"], rsvpByMemberId: { a: "yes", z: "yes" } }),
      new Set(["a"]),
    );
    expect(counts.convoked).toBe(1);
  });
});

describe("computeTeamAttendance", () => {
  const events = [
    event({ id: "1", teamMemberIds: ["a", "b", "c"], rsvpByMemberId: { a: "yes", b: "yes" } }),
    event({ id: "2", type: "match", startsAt: "2026-11-22T14:00:00", teamMemberIds: ["a", "b", "c"], rsvpByMemberId: { a: "yes", b: "no" } }),
    event({ id: "3", startsAt: "2026-11-24T18:00:00", teamMemberIds: ["a", "c"], rsvpByMemberId: { a: "yes" } }),
    event({ id: "future", startsAt: "2026-12-01T18:00:00", teamMemberIds: ["a"], rsvpByMemberId: { a: "yes" } }),
    event({ id: "other", teamIds: ["t2"], teamMemberIds: ["a"], rsvpByMemberId: { a: "no" } }),
  ];

  const result = computeTeamAttendance({ team, events, names, now });

  it("ignore le futur et les autres équipes", () => {
    expect(result.eventCount).toBe(3);
    expect(result.events.map((row) => row.id)).toEqual(["3", "2", "1"]);
  });

  it("calcule les taux globaux et par type", () => {
    // 8 convocations, 4 oui ; 5 réponses sur 8.
    expect(result.rate).toBe(50);
    expect(result.responseRate).toBe(63);
    expect(result.trainingRate).toBe(60);
    expect(result.matchRate).toBe(33);
  });

  it("trie les joueurs du moins présent au plus présent", () => {
    expect(result.players.map((p) => [p.name, p.rate])).toEqual([
      ["Chloé", 0],
      ["Bruno", 50],
      ["Alice", 100],
    ]);
    expect(isLowResponder(result.players[0]!)).toBe(true);
    expect(isLowResponder(result.players[2]!)).toBe(false);
  });

  it("résume plusieurs équipes", () => {
    const summary = summarizeAttendance({ teams: [team], events, now });
    expect(summary.eventCount).toBe(3);
    expect(summary.lowResponders).toBe(1);
    expect(summary.rate).toBe(50);
  });
});

describe("joueurs et coachs", () => {
  const coached = { ...team, coachIds: ["k", "a"] };
  const events = [
    event({ id: "1", teamMemberIds: ["a", "b", "k"], rsvpByMemberId: { a: "yes", k: "yes" } }),
    event({ id: "2", teamMemberIds: ["a", "b", "k"], rsvpByMemberId: { k: "yes" } }),
    // Coach seul convoqué : l'événement compte pour les stats mixtes.
    event({ id: "3", teamMemberIds: ["k"], rsvpByMemberId: {} }),
  ];
  const result = computeTeamAttendance({ team: coached, events, names, now });

  it("sépare les joueurs des coachs (un joueur-coach reste joueur)", () => {
    expect(result.coaches.map((row) => [row.memberId, row.name, row.yes])).toEqual([
      ["k", "Coach", 2],
    ]);
    expect(result.eventCount).toBe(3);
    // Joueurs : 4 convocations, 1 oui.
    expect(result.rate).toBe(25);
    expect(result.trainingRate).toBe(25);
    // Joueurs + coachs : 7 convocations, 3 oui, 4 réponses.
    expect(result.allTotals).toMatchObject({ convoked: 7, yes: 3, none: 4 });
    expect(result.allRate).toBe(43);
    expect(result.allResponseRate).toBe(43);
    expect(result.events.find((row) => row.id === "1")).toMatchObject({
      coachConvoked: 1,
      coachYes: 1,
    });
  });

  it("résume les deux périmètres", () => {
    const summary = summarizeAttendance({ teams: [coached], events, now });
    expect(summary.rate).toBe(25);
    expect(summary.allRate).toBe(43);
  });
});

describe("périmètre des événements", () => {
  it("ignore les événements « tout le club » et ceux du jour sans heure", () => {
    const today = new Date(2026, 10, 26).toISOString();
    const result = computeTeamAttendance({
      team,
      events: [
        event({ id: "ag", allTeams: true, teamIds: ["t1", "t2"], teamMemberIds: ["a"] }),
        event({ id: "soir", startsAt: today, startTimeSet: false, teamMemberIds: ["a"] }),
        event({ id: "ok", teamMemberIds: ["a"], rsvpByMemberId: { a: "yes" } }),
      ],
      names,
      now,
    });
    expect(result.events.map((row) => row.id)).toEqual(["ok"]);
  });

  it("compte une fois un événement partagé par deux équipes", () => {
    const u17 = { id: "t2", name: "U17", category: "U17", playerIds: ["a", "d"] };
    const shared = event({
      teamIds: ["t1", "t2"],
      teamMemberIds: ["a", "b", "d"],
      rsvpByMemberId: { a: "yes" },
    });
    const summary = summarizeAttendance({
      teams: [team, u17],
      events: [shared],
      now,
    });
    expect(summary.eventCount).toBe(1);
    expect(summary.totals.convoked).toBe(3);
  });

  it("à relancer : sans réponse strictement plus d’une fois sur deux", () => {
    expect(isLowResponder({ convoked: 4, none: 2 })).toBe(false);
    expect(isLowResponder({ convoked: 4, none: 3 })).toBe(true);
  });
});

describe("attendancePeriodStart", () => {
  it("saison : 1er août précédent", () => {
    expect(attendancePeriodStart("season", now)).toEqual(new Date(2026, 7, 1));
    expect(attendancePeriodStart("season", new Date(2027, 2, 10))).toEqual(
      new Date(2026, 7, 1),
    );
  });

  it("30 jours", () => {
    expect(attendancePeriodStart("30d", now)).toEqual(
      new Date(new Date(2026, 10, 26).getTime() - 30 * 86_400_000),
    );
  });
});
