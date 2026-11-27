import { describe, expect, it } from "vitest";
import { buildIcs, icsFileName, type IcsExportEvent } from "./icsExport";

const now = new Date("2026-11-26T10:00:00Z");

function makeEvent(overrides: Partial<IcsExportEvent> = {}): IcsExportEvent {
  return {
    id: "evt1",
    clubId: "club1",
    clubName: "VB Viroflay",
    title: "Match contre Versailles",
    type: "match",
    startsAt: "2026-11-28T14:00:00Z",
    endsAt: "2026-11-28T16:00:00Z",
    location: "Gymnase Macé, Viroflay",
    teamLabels: ["M15"],
    ...overrides,
  };
}

describe("buildIcs", () => {
  it("comme l’app : 18 h et 2 h sans horaire, club non dupliqué, réunion", () => {
    const noTime = new Date("2026-11-29T00:00:00");
    const ics = buildIcs(
      [
        makeEvent({
          id: "notime",
          startsAt: noTime.toISOString(),
          endsAt: new Date(noTime.getTime() + 75 * 60_000).toISOString(),
          startTimeSet: false,
          endTimeSet: false,
          teamLabels: ["VB Viroflay", "M15"],
        }),
        makeEvent({ id: "meet", type: "meeting", title: "Réunion - Bureau" }),
      ],
      { now },
    );
    const start = new Date(noTime);
    start.setHours(18, 0, 0, 0);
    const stamp = (date: Date) =>
      date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    expect(ics).toContain(`DTSTART:${stamp(start)}`);
    expect(ics).toContain(
      `DTEND:${stamp(new Date(start.getTime() + 2 * 60 * 60_000))}`,
    );
    expect(ics).not.toContain("VB Viroflay · VB Viroflay");
    expect(ics).toContain("SUMMARY:Réunion · Bureau");
  });

  it("écrit un VEVENT en UTC avec l’UID de l’app", () => {
    const ics = buildIcs([makeEvent()], { now });
    expect(ics).toContain("UID:club1-evt1@viroteam.app");
    expect(ics).toContain("DTSTART:20261128T140000Z");
    expect(ics).toContain("DTEND:20261128T160000Z");
    expect(ics).toContain("DTSTAMP:20261126T100000Z");
    expect(ics).toContain("SUMMARY:Match contre Versailles");
    expect(ics).toContain("LOCATION:Gymnase Macé\\, Viroflay");
    expect(ics).toContain("DESCRIPTION:VB Viroflay · M15");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("écarte les événements terminés et trie par début", () => {
    const ics = buildIcs(
      [
        makeEvent({ id: "late", startsAt: "2026-12-05T10:00:00Z", endsAt: "2026-12-05T11:00:00Z" }),
        makeEvent({ id: "past", startsAt: "2026-11-20T10:00:00Z", endsAt: "2026-11-20T11:00:00Z" }),
        makeEvent({ id: "soon" }),
      ],
      { now },
    );
    expect(ics).not.toContain("past@");
    expect(ics.indexOf("soon@")).toBeLessThan(ics.indexOf("late@"));
  });

  it("garde un événement en cours", () => {
    const ics = buildIcs(
      [makeEvent({ startsAt: "2026-11-26T09:00:00Z", endsAt: "2026-11-26T11:00:00Z" })],
      { now },
    );
    expect(ics).toContain("UID:club1-evt1@viroteam.app");
  });

  it("utilise le type quand le titre est vide et omet le lieu vide", () => {
    const ics = buildIcs([makeEvent({ title: " ", location: "" })], { now });
    expect(ics).toContain("SUMMARY:Match");
    expect(ics).not.toContain("LOCATION:");
  });

  it("replie les lignes longues à 75 octets", () => {
    const ics = buildIcs([makeEvent({ title: "é".repeat(80) })], { now });
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${"é".repeat(80)}`);
  });
});

describe("icsFileName", () => {
  it("date le fichier", () => {
    expect(icsFileName(new Date(2026, 10, 26))).toBe(
      "viroteam_planning_2026-11-26.ics",
    );
  });
});
