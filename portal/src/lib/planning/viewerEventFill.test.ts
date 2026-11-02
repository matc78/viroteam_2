import { describe, expect, it } from "vitest";
import { resolveViewerEventFill, viewerEventFillAttr } from "./viewerEventFill";

describe("resolveViewerEventFill", () => {
  it("retourne default sans ids viewer", () => {
    expect(
      resolveViewerEventFill({
        teamMemberIds: ["mem-a"],
        rsvpByMemberId: { "mem-a": "yes" },
        viewerMatchIds: [],
      }),
    ).toBe("default");
  });

  it("retourne default si le viewer n'est pas convoqué", () => {
    expect(
      resolveViewerEventFill({
        teamMemberIds: ["mem-b"],
        rsvpByMemberId: {},
        viewerMatchIds: ["mem-a"],
      }),
    ).toBe("default");
  });

  it("distingue oui, peut-être, non et sans réponse", () => {
    const base = { teamMemberIds: ["mem-a"], viewerMatchIds: ["mem-a"] };
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
        rsvpByMemberId: { "uid-a": "MAYBE" },
        viewerMatchIds: ["mem-a", "uid-a"],
      }),
    ).toBe("maybe");
  });

  it("lit la réponse portée par un alias (uid)", () => {
    expect(
      resolveViewerEventFill({
        teamMemberIds: ["mem-a"],
        rsvpByMemberId: { "uid-a": "no" },
        viewerMatchIds: ["mem-a", "uid-a"],
      }),
    ).toBe("declined");
  });
});

describe("viewerEventFillAttr", () => {
  it("omet l'attribut pour default", () => {
    expect(viewerEventFillAttr("default")).toBeUndefined();
    expect(viewerEventFillAttr("maybe")).toBe("maybe");
  });
});
