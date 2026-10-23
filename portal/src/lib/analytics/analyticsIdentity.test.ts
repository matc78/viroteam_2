import { describe, expect, it } from "vitest";
import type { ClubRecord } from "@/lib/firebase/clubService";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/firebase/notificationPreferences";
import type { ViroUserProfile } from "@/lib/firebase/types";
import {
  ANALYTICS_NO_ROLE,
  analyticsClubProperties,
  analyticsPersonProperties,
} from "./analyticsIdentity";

function makeProfile(overrides: Partial<ViroUserProfile> = {}): ViroUserProfile {
  return {
    uid: "u1",
    email: "coach@example.com",
    emailNorm: "coach@example.com",
    firstName: "Alex",
    lastName: "Martin",
    displayName: "Alex Martin",
    avatarUrl: null,
    clubMemberships: [],
    parentLinks: [],
    parentClubIds: [],
    parentTeamIds: [],
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    profileCompleted: true,
    disabled: false,
    termsAcceptedAt: null,
    termsVersion: null,
    ...overrides,
  };
}

describe("analyticsPersonProperties", () => {
  it("retient le rôle le plus élevé et compte les clubs distincts", () => {
    const properties = analyticsPersonProperties(
      makeProfile({
        clubMemberships: [
          { clubId: "c1", role: "player" },
          { clubId: "c2", role: "admin" },
          { clubId: "c3", role: "coach" },
        ],
        parentClubIds: ["c1", "c4"],
        parentLinks: [{ clubId: "c4", memberId: "m1", relation: "parent", status: "active" }],
      }),
    );

    expect(properties).toEqual({ max_role: "admin", is_parent: true, club_count: 4 });
  });

  it("parent seul : aucun rôle club", () => {
    const properties = analyticsPersonProperties(makeProfile());

    expect(properties).toEqual({ max_role: ANALYTICS_NO_ROLE, is_parent: false, club_count: 0 });
  });

  it("n’expose aucune donnée personnelle", () => {
    const serialized = JSON.stringify(analyticsPersonProperties(makeProfile()));

    expect(serialized).not.toContain("example.com");
    expect(serialized).not.toContain("Martin");
  });
});

describe("analyticsClubProperties", () => {
  it("garde nom, sport et effectif", () => {
    const club = { name: "US Viro", sport: "volley", memberCount: 42 } as ClubRecord;

    expect(analyticsClubProperties(club)).toEqual({
      name: "US Viro",
      sport: "volley",
      member_count: 42,
    });
  });
});
