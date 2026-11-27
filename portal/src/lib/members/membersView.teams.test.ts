import { describe, expect, it } from "vitest";
import { formatMemberTeamLabel } from "./membersView";

describe("formatMemberTeamLabel", () => {
  it("affiche « sparring » à la place de « joueur »", () => {
    const base = { teamId: "t", teamName: "Séniors", isCoach: false, isPlayer: true };
    expect(formatMemberTeamLabel({ ...base, isSparring: false })).toBe("Séniors (joueur)");
    expect(formatMemberTeamLabel({ ...base, isSparring: true })).toBe("Séniors (sparring)");
    expect(
      formatMemberTeamLabel({ ...base, isCoach: true, isSparring: true }),
    ).toBe("Séniors (coach + sparring)");
  });
});
