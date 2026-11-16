import { describe, expect, it } from "vitest";
import type { ClubRecord } from "@/lib/firebase/clubService";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/firebase/notificationPreferences";
import type { ViroUserProfile } from "@/lib/firebase/types";
import {
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
    memberClubIds: [],
    parentLinks: [],
    parentClubIds: [],
    parentTeamIds: [],
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    profileCompleted: true,
    disabled: false,
    chatMessaging: false,
    termsAcceptedAt: null,
    termsVersion: null,
    ...overrides,
  };
}

describe("analyticsPersonProperties", () => {
  it("compte les clubs distincts (membre ou parent)", () => {
    const properties = analyticsPersonProperties(
      makeProfile({
        memberClubIds: ["c1", "c2", "c3"],
        parentClubIds: ["c1", "c4"],
        parentLinks: [{ clubId: "c4", memberId: "m1", relation: "parent", status: "active" }],
      }),
    );

    expect(properties).toEqual({ is_parent: true, club_count: 4 });
  });

  it("compte sans club ni lien parent", () => {
    const properties = analyticsPersonProperties(makeProfile());

    expect(properties).toEqual({ is_parent: false, club_count: 0 });
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
