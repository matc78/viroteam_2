import { describe, expect, it } from "vitest";
import { Fields } from "./constants";
import { parseUserProfile } from "./types";

describe("parseUserProfile flags.chatMessaging", () => {
  it("lit true depuis flags", () => {
    const profile = parseUserProfile("u1", {
      [Fields.email]: "a@b.fr",
      [Fields.flags]: { [Fields.chatMessaging]: true },
    });
    expect(profile.chatMessaging).toBe(true);
  });

  it("défaut false si absent ou non strictement true", () => {
    expect(parseUserProfile("u1", undefined).chatMessaging).toBe(false);
    expect(
      parseUserProfile("u1", { [Fields.flags]: {} }).chatMessaging,
    ).toBe(false);
    expect(
      parseUserProfile("u1", {
        [Fields.flags]: { [Fields.chatMessaging]: "true" },
      }).chatMessaging,
    ).toBe(false);
  });
});
