import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  parseNotificationPreferences,
} from "./notificationPreferences";

describe("parseNotificationPreferences", () => {
  it("défauts : récap actif, réponses des coéquipiers en opt-in", () => {
    expect(parseNotificationPreferences(undefined)).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES,
    );
    expect(DEFAULT_NOTIFICATION_PREFERENCES.weeklyDigest).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.rsvpTeammates).toBe(false);
  });

  it("garde les choix faits dans l'app (le map est réécrit en entier)", () => {
    const parsed = parseNotificationPreferences({
      weeklyDigest: false,
      rsvpTeammates: true,
      events: "oui",
    });
    expect(parsed.weeklyDigest).toBe(false);
    expect(parsed.rsvpTeammates).toBe(true);
    expect(parsed.events).toBe(true);
  });
});
