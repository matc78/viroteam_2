import { beforeEach, describe, expect, it, vi } from "vitest";

/** Comportement de `getDoc` par id de club (ok / absent / refusé / réseau). */
const clubBehaviour = new Map<string, "ok" | "missing" | "denied" | "network">();

vi.mock("./app", () => ({ getAppFirestore: () => ({}) }));

vi.mock("firebase/firestore", () => ({
  Timestamp: class {},
  updateDoc: vi.fn(),
  doc: (_db: unknown, _collection: string, id: string) => ({ id }),
  getDoc: async (ref: { id: string }) => {
    const behaviour = clubBehaviour.get(ref.id) ?? "missing";
    if (behaviour === "denied") {
      throw Object.assign(new Error("denied"), { code: "permission-denied" });
    }
    if (behaviour === "network") {
      throw Object.assign(new Error("offline"), { code: "unavailable" });
    }
    return {
      exists: () => behaviour === "ok",
      data: () => ({ name: `Club ${ref.id}` }),
    };
  },
}));

const { getClubsByIds } = await import("./clubService");

describe("getClubsByIds", () => {
  beforeEach(() => {
    clubBehaviour.clear();
  });

  it("ignore un club refusé par les rules (membre retiré)", async () => {
    clubBehaviour.set("a", "ok");
    clubBehaviour.set("b", "denied");
    const clubs = await getClubsByIds(["a", "b"]);
    expect(clubs.map((club) => club.id)).toEqual(["a"]);
  });

  it("tous refusés → liste vide (pas d’erreur bloquante)", async () => {
    clubBehaviour.set("b", "denied");
    await expect(getClubsByIds(["b"])).resolves.toEqual([]);
  });

  it("erreur réseau sans aucun club lu → rejette (écran Réessayer)", async () => {
    clubBehaviour.set("a", "network");
    await expect(getClubsByIds(["a"])).rejects.toThrow("offline");
  });

  it("déduplique les ids", async () => {
    clubBehaviour.set("a", "ok");
    const clubs = await getClubsByIds(["a", "a", ""]);
    expect(clubs).toHaveLength(1);
  });
});
