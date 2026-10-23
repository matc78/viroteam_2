import { describe, expect, it } from "vitest";
import { site } from "@/lib/site";
import { appStoreLink, playStoreLink } from "./storeLinks";

describe("storeLinks", () => {
  it("ajoute un referrer UTM encodé au lien Google Play", () => {
    const url = new URL(playStoreLink("store_badges"));
    expect(url.searchParams.get("id")).toBe("com.viroteam.viro_team");
    expect(url.searchParams.get("referrer")).toBe(
      "utm_source=portal&utm_campaign=store_badges",
    );
    expect(url.toString().startsWith(site.playStoreUrl)).toBe(true);
  });

  it("ajoute la campagne ct au lien App Store", () => {
    const url = new URL(appStoreLink("invite_share"));
    expect(url.origin + url.pathname).toBe(site.appStoreUrl);
    expect(url.searchParams.get("ct")).toBe("portal_invite_share");
    expect(url.searchParams.get("mt")).toBe("8");
  });
});
