import { describe, expect, it } from "vitest";
import { resolveViewerEventFill, viewerEventFillAttr } from "./viewerEventFill";

describe("resolveViewerEventFill", () => {
  it("retourne default sans ids viewer", () => {
    expect(
      resolveViewerEventFill({
        teamMemberIds: ["mem-a"],
        rsvpByMemberId: { "mem-a": "yes" },
        viewerMemberIds: [],
      }),
    ).toBe("default");
  });

  it("retourne default si le viewer n'est pas convoqué", () => {
    expect(
      resolveViewerEventFill({
        teamMemberIds: ["mem-b"],
        rsvpByMemberId: {},
        viewerMemberIds: ["mem-a"],
      }),
    ).toBe("default");
  });

  it("distingue oui, peut-être, non et sans réponse", () => {
    const base = { teamMemberIds: ["mem-a"], viewerMemberIds: ["mem-a"] };
    expect(
      resolveViewerEventFill({ ...base, rsvpByMemberId: { "mem-a": "yes" } }),
    ).toBe("filled");
    expect(
      resolveViewerEventFill({ ...base, rsvpByMemberId: { "mem-a": "maybe" } }),
    ).toBe("maybe");
    expect(
      resolveViewerEventFill({ ...base, rsvpByMemberId: { "mem-a": "no" } }),
    ).toBe("declined");
    expect(resolveViewerEventFill({ ...base, rsvpByMemberId: {} })).toBe(
      "outline",
    );
  });

  it("traite une audience vide comme ouverte à tous", () => {
    expect(
      resolveViewerEventFill({
        teamMemberIds: [],
        rsvpByMemberId: { "mem-a": "MAYBE" },
        viewerMemberIds: ["mem-a"],
      }),
    ).toBe("maybe");
  });

  it("ignore la réponse d'une autre fiche (une seule clé membre)", () => {
    expect(
      resolveViewerEventFill({
        teamMemberIds: ["mem-a"],
        rsvpByMemberId: { "mem-b": "no" },
        viewerMemberIds: ["mem-a"],
      }),
    ).toBe("outline");
  });
});

describe("viewerEventFillAttr", () => {
  it("omet l'attribut pour default", () => {
    expect(viewerEventFillAttr("default")).toBeUndefined();
    expect(viewerEventFillAttr("maybe")).toBe("maybe");
  });
});
