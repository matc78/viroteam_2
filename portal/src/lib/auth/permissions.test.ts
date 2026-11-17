import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CLUB_FUNCTIONS,
  CLUB_PERMISSIONS,
  COACH_FLAG_DEFAULTS,
  PERMISSION_ADMIN,
  PERMISSION_IMPLIES,
  buildClubAccess,
  can,
  canAddPlayerToTeam,
  canCreateEventFor,
  canCreateEvents,
  canEditMemberRsvp,
  canManageEvent,
  canManageEventAudience,
  canPublishAnnouncementToTeams,
  canWriteStaffChannels,
  derivedBadges,
  functionState,
  grantsPermission,
  impliedByPermission,
  normalizePermissions,
  parsePermissions,
  primaryBadge,
  toDisplayBadge,
} from "./permissions";
import { accountClubBadge } from "@/lib/firebase/types";

const SHARED_CATALOG = fileURLToPath(
  new URL("../../../../shared/permissions_catalog.json", import.meta.url),
);

describe("catalogue des droits", () => {
  it("est identique au catalogue partagé", () => {
    const shared = JSON.parse(readFileSync(SHARED_CATALOG, "utf8"));
    expect([...CLUB_PERMISSIONS]).toEqual(shared.permissions);
    expect(PERMISSION_ADMIN).toBe(shared.adminPermission);
    expect(PERMISSION_IMPLIES).toEqual(shared.implies);
    expect(CLUB_FUNCTIONS).toEqual(shared.functions);
    expect(COACH_FLAG_DEFAULTS).toEqual(shared.coachFlags);
  });

  it("ne connaît plus de modèles de rôle", () => {
    const shared = JSON.parse(readFileSync(SHARED_CATALOG, "utf8"));
    expect(shared.templates).toBeUndefined();
  });
});

describe("parsePermissions", () => {
  it("ignore les identifiants inconnus et trie", () => {
    expect(parsePermissions(["viewActivity", "owner", "manageTeams"])).toEqual([
      "manageTeams",
      "viewActivity",
    ]);
    expect(parsePermissions(undefined)).toEqual([]);
  });
});

describe("normalizePermissions", () => {
  it("ajoute les droits impliqués", () => {
    expect(normalizePermissions(["manageFees"])).toEqual([
      "manageFees",
      "viewFees",
    ]);
  });

  it("réduit la liste à admin", () => {
    expect(normalizePermissions(["manageFees", "admin"])).toEqual(["admin"]);
  });
});

describe("grantsPermission", () => {
  it("admin accorde tout", () => {
    expect(grantsPermission(["admin"], "manageFees")).toBe(true);
    expect(grantsPermission(["viewFees"], "manageFees")).toBe(false);
  });
});

describe("functionState", () => {
  it("cochée, partielle ou absente", () => {
    expect(functionState("membersManager", ["manageMembers", "manageTeams"])).toBe(
      "full",
    );
    expect(functionState("membersManager", ["manageTeams"])).toBe("partial");
    expect(functionState("membersManager", ["viewFees"])).toBe("none");
    expect(functionState("membersManager", ["admin"])).toBe("full");
  });
});

describe("éditeur de droits", () => {
  it("viewFees est impliqué par manageFees", () => {
    expect(impliedByPermission("viewFees", ["manageFees", "viewFees"])).toBe(
      "manageFees",
    );
    expect(impliedByPermission("viewFees", ["viewFees"])).toBeNull();
  });

});

describe("badge affiché", () => {
  it("badge inconnu ou absent → membre", () => {
    expect(toDisplayBadge("owner")).toBe("member");
    expect(toDisplayBadge(null)).toBe("member");
    expect(toDisplayBadge("parent")).toBe("parent");
  });

  it("membre avec lien parent dans le club → Parent", () => {
    const memberOnly = buildClubAccess({ permissions: ["viewFees"] });
    expect(accountClubBadge(memberOnly, true)).toBe("parent");
    expect(accountClubBadge(memberOnly, false)).toBe("member");
    const player = buildClubAccess({ teamIds: ["a"] });
    expect(accountClubBadge(player, true)).toBe("player");
    expect(accountClubBadge(undefined, false)).toBeNull();
  });
});

describe("derivedBadges", () => {
  it("cumule admin, coach et joueur", () => {
    expect(
      derivedBadges({
        permissions: ["admin"],
        coachTeamIds: ["a"],
        teamIds: ["a", "b"],
      }),
    ).toEqual(["admin", "coach", "player"]);
  });

  it("donne « membre » sans équipe ni droit admin", () => {
    expect(
      derivedBadges({ permissions: ["manageFees"], coachTeamIds: [], teamIds: [] }),
    ).toEqual(["member"]);
  });
});

describe("primaryBadge", () => {
  it("Admin > Entraîneur > Joueur > Membre, jamais nul", () => {
    const base = { permissions: [], coachTeamIds: [], teamIds: [] };
    expect(primaryBadge({ ...base, permissions: ["admin"], teamIds: ["a"] })).toBe(
      "admin",
    );
    expect(primaryBadge({ ...base, coachTeamIds: ["a"], teamIds: ["a", "b"] })).toBe(
      "coach",
    );
    expect(primaryBadge({ ...base, teamIds: ["a"] })).toBe("player");
    expect(primaryBadge(base)).toBe("member");
  });
});

describe("ClubAccess", () => {
  const coach = buildClubAccess({ coachTeamIds: ["a"], teamIds: ["a"] });

  it("sans fiche : aucun droit", () => {
    const none = buildClubAccess(null);
    expect(none.isStaff).toBe(false);
    expect(canCreateEvents(none)).toBe(false);
    expect(can(none, "viewFees")).toBe(false);
  });

  it("admin accorde tout, un droit isolé n'ouvre que lui", () => {
    const admin = buildClubAccess({ permissions: ["admin"] });
    expect(admin.isAdmin).toBe(true);
    expect(can(admin, "manageFees")).toBe(true);
    const treasurer = buildClubAccess({
      permissions: ["manageFees", "viewFees"],
    });
    expect(can(treasurer, "viewFees")).toBe(true);
    expect(can(treasurer, "manageMembers")).toBe(false);
    expect(treasurer.isStaff).toBe(true);
    expect(treasurer.isTeamCoach).toBe(false);
  });

  it("le coach agit sur ses équipes seulement", () => {
    expect(canCreateEventFor(coach, ["a"])).toBe(true);
    expect(canCreateEventFor(coach, ["a", "b"])).toBe(false);
    expect(canManageEvent(coach, { teamIds: ["b"] })).toBe(false);
    expect(canAddPlayerToTeam(coach, "a")).toBe(true);
    expect(canAddPlayerToTeam(coach, "b")).toBe(false);
    expect(canPublishAnnouncementToTeams(coach, ["a"])).toBe(true);
    expect(canPublishAnnouncementToTeams(coach, ["a", "b"])).toBe(false);
    expect(canWriteStaffChannels(coach)).toBe(true);
    expect(canEditMemberRsvp(coach, { teamIds: ["a"] })).toBe(false);
  });

  it("le coach gère un événement seulement s'il entraîne toutes ses équipes", () => {
    const multiCoach = buildClubAccess(
      { coachTeamIds: ["a", "b"] },
      { ...COACH_FLAG_DEFAULTS, canEditMemberRsvp: true },
    );
    expect(canManageEvent(multiCoach, { teamIds: ["a", "b"] })).toBe(true);
    expect(canManageEvent(coach, { teamIds: ["a", "b"] })).toBe(false);
    expect(canManageEventAudience(coach, { teamIds: ["a"] })).toBe(true);
    expect(canManageEventAudience(coach, { teamIds: ["a", "b"] })).toBe(false);
    expect(canManageEvent(coach, { teamIds: [] })).toBe(false);
    // RSVP d'autrui : coach d'au moins une des équipes suffit.
    expect(canEditMemberRsvp(multiCoach, { teamIds: ["a", "c"] })).toBe(true);
  });

  it("le coach n'agit jamais sur un événement « tout le club »", () => {
    const multiCoach = buildClubAccess(
      { coachTeamIds: ["a", "b"] },
      { ...COACH_FLAG_DEFAULTS, canEditMemberRsvp: true },
    );
    const clubEvent = { teamIds: ["a", "b"], allTeams: true };
    expect(canManageEvent(multiCoach, clubEvent)).toBe(false);
    expect(canManageEventAudience(multiCoach, clubEvent)).toBe(false);
    expect(canEditMemberRsvp(multiCoach, clubEvent)).toBe(false);
  });

  it("manageEvents garde tout, même « tout le club »", () => {
    const planner = buildClubAccess({ permissions: ["manageEvents"] });
    const clubEvent = { teamIds: [], allTeams: true };
    expect(canManageEvent(planner, clubEvent)).toBe(true);
    expect(canManageEventAudience(planner, clubEvent)).toBe(true);
    expect(canEditMemberRsvp(planner, clubEvent)).toBe(true);
  });

  it("les réglages du club coupent ses capacités", () => {
    const restricted = buildClubAccess(
      { coachTeamIds: ["a"] },
      { ...COACH_FLAG_DEFAULTS, canCreateEvents: false },
    );
    expect(canCreateEvents(restricted)).toBe(false);
    expect(canManageEventAudience(restricted, { teamIds: ["a"] })).toBe(true);
  });

  it("ignore les droits inconnus", () => {
    expect(buildClubAccess({ permissions: ["owner"] }).isStaff).toBe(false);
  });
});
