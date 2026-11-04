import { afterEach, describe, expect, it, vi } from "vitest";

describe("isChatMessagingLive", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("env local seul active la messagerie", async () => {
    vi.stubEnv("NEXT_PUBLIC_CHAT_MESSAGING_LIVE", "true");
    const { isChatMessagingLive } = await import("./featureFlags");
    expect(isChatMessagingLive(null)).toBe(true);
    expect(isChatMessagingLive({ chatMessaging: false })).toBe(true);
  });

  it("sans env : seul flags.chatMessaging active", async () => {
    vi.stubEnv("NEXT_PUBLIC_CHAT_MESSAGING_LIVE", "");
    const { isChatMessagingLive, CHAT_MESSAGING_LIVE } = await import(
      "./featureFlags"
    );
    expect(CHAT_MESSAGING_LIVE).toBe(false);
    expect(isChatMessagingLive(null)).toBe(false);
    expect(isChatMessagingLive({ chatMessaging: false })).toBe(false);
    expect(isChatMessagingLive({ chatMessaging: true })).toBe(true);
  });
});
