import { describe, expect, it } from "vitest";
import { buildClubAccess } from "@/lib/auth/permissions";
import {
  bureauCapabilities,
  isBureauRouteAllowed,
} from "@/lib/auth/bureauPermissions";

/** Capacités d'une fiche décrite par ses droits et ses équipes. */
function capsFor(member: {
  permissions?: string[];
  coachTeamIds?: string[];
  teamIds?: string[];
}) {
  return bureauCapabilities(
    buildClubAccess({
      permissions: member.permissions ?? [],
      coachTeamIds: member.coachTeamIds ?? [],
      teamIds: member.teamIds ?? [],
    }),
  );
}

describe("bureauCapabilities — page Membres", () => {
  it("l'ouvre à qui voit tout le club", () => {
    const caps = capsFor({ permissions: ["manageMembers"] });
    expect(caps.navHrefs).toContain("/members");
    expect(caps.navHrefs).not.toContain("/team");
  });

  it("l'ouvre au coach d'une équipe, sans droit club", () => {
    const caps = capsFor({ coachTeamIds: ["t1"], teamIds: ["t1"] });
    expect(caps.navHrefs).toContain("/members");
  });

  it("la retire à un responsable cotisations sans équipe (vue Équipe à la place)", () => {
    const caps = capsFor({ permissions: ["manageFees", "viewFees"] });
    expect(caps.isStaff).toBe(true);
    expect(caps.navHrefs).not.toContain("/members");
    expect(caps.navHrefs).toContain("/team");
    expect(caps.navHrefs).toContain("/fees");
    expect(isBureauRouteAllowed("/members", caps)).toBe(false);
  });

  it("la retire au seul droit planning, comme l'app (canOpenMembers)", () => {
    const caps = capsFor({ permissions: ["manageEvents"] });
    expect(caps.seesWholeClub).toBe(true);
    expect(caps.navHrefs).not.toContain("/members");
    expect(caps.navHrefs).toContain("/team");
  });

  it("l'ouvre au droit équipes seul", () => {
    expect(capsFor({ permissions: ["manageTeams"] }).navHrefs).toContain(
      "/members",
    );
  });

  it("garde la vue Équipe pour un joueur", () => {
    const caps = capsFor({ teamIds: ["t1"] });
    expect(caps.navHrefs).toContain("/team");
    expect(caps.navHrefs).not.toContain("/members");
  });
});

describe("bureauCapabilities — paramètres et compte", () => {
  it("réserve /settings au droit Paramètres du club", () => {
    expect(capsFor({}).navHrefs).not.toContain("/settings");
    expect(
      capsFor({ permissions: ["manageClubSettings"] }).navHrefs,
    ).toContain("/settings");
    expect(capsFor({ permissions: ["admin"] }).navHrefs).toContain("/settings");
  });

  it("laisse /account accessible à tout membre", () => {
    expect(isBureauRouteAllowed("/account", capsFor({}))).toBe(true);
  });
});
