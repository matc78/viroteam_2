import { describe, expect, it, vi } from "vitest";
import { dedupeInFlight } from "./dedupeInFlight";

describe("dedupeInFlight", () => {
  it("mutualise les appels concurrents de même clé", async () => {
    const load = vi.fn(async () => "équipes");
    const [first, second] = await Promise.all([
      dedupeInFlight("teams:c1", load),
      dedupeInFlight("teams:c1", load),
    ]);
    expect(first).toBe("équipes");
    expect(second).toBe("équipes");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("relit après résolution (aucun cache durable)", async () => {
    const load = vi.fn(async () => 1);
    await dedupeInFlight("season:c1", load);
    await dedupeInFlight("season:c1", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("libère la clé après un échec", async () => {
    const failing = vi.fn(async () => {
      throw new Error("réseau");
    });
    await expect(dedupeInFlight("k", failing)).rejects.toThrow("réseau");
    const ok = vi.fn(async () => "ok");
    await expect(dedupeInFlight("k", ok)).resolves.toBe("ok");
  });
});
