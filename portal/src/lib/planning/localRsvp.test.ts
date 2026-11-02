import { describe, expect, it } from "vitest";
import type { ClubEventView } from "@/lib/firebase/eventService";
import { eventHasRsvp, withLocalRsvp } from "./localRsvp";

function makeEvent(overrides: Partial<ClubEventView> = {}): ClubEventView {
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
    teamMemberIds: ["mem-a", "mem-b"],
    excludedMemberIds: [],
    seriesId: null,
    rsvpByMemberId: {},
    rsvpYes: 0,
    rsvpNo: 0,
    rsvpPending: 2,
    rsvpTotal: 2,
    ...overrides,
  };
}

describe("withLocalRsvp", () => {
  it("écrit la réponse pour chaque alias et recalcule les compteurs", () => {
    const next = withLocalRsvp(
      makeEvent({ rsvpByMemberId: { "mem-b": "no" }, rsvpNo: 1, rsvpPending: 1 }),
      ["mem-a"],
      "yes",
    );
    expect(next.rsvpByMemberId).toEqual({ "mem-a": "yes", "mem-b": "no" });
    expect(next.rsvpYes).toBe(1);
    expect(next.rsvpNo).toBe(1);
    expect(next.rsvpPending).toBe(0);
  });

  it("ne modifie pas l'événement source", () => {
    const source = makeEvent();
    withLocalRsvp(source, ["mem-a"], "maybe");
    expect(source.rsvpByMemberId).toEqual({});
  });
});

describe("eventHasRsvp", () => {
  it("confirme quand tous les ids répondus portent la valeur", () => {
    const event = makeEvent({ rsvpByMemberId: { "uid-a": "yes" } });
    expect(eventHasRsvp(event, ["mem-a", "uid-a"], "yes")).toBe(true);
  });

  it("refuse sans réponse ou si un alias porte encore l'ancienne valeur", () => {
    expect(eventHasRsvp(makeEvent(), ["mem-a"], "yes")).toBe(false);
    const stale = makeEvent({
      rsvpByMemberId: { "mem-a": "yes", "uid-a": "no" },
    });
    expect(eventHasRsvp(stale, ["mem-a", "uid-a"], "yes")).toBe(false);
  });
});
