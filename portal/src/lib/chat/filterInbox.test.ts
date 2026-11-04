import { describe, expect, it, vi } from "vitest";
import { makeChatState, makeConversation } from "./chatTestFixtures";

vi.mock("@/lib/firebase/app", () => ({
  getAppFirestore: () => ({}),
  getFirebaseApp: () => ({}),
  getFirestoreDatabaseId: () => "v2-dev",
}));

const { filterInbox } = await import("./filterInbox");

const at = (day: number) => new Date(2026, 10, day, 12, 0);

const team = makeConversation({
  id: "team",
  title: "U13 Garçons",
  lastMessagePreview: "Entraînement annulé",
  lastMessageAt: at(3),
});
const dm = makeConversation({
  id: "dm",
  type: "dm",
  title: "",
  lastMessagePreview: "Ok merci",
  lastMessageAt: at(2),
});
const renamed = makeConversation({
  id: "renamed",
  clubId: "club2",
  title: "Staff",
  titleOverride: "Bureau du club",
  lastMessagePreview: "",
  lastMessageAt: at(1),
});

const base = {
  conversations: [renamed, dm, team],
  chatStates: {},
  clubNameById: { club1: "AS Viro", club2: "FC Nord" },
  dmPeerNameByKey: { club1_dm: "Léa Martin" },
};

function ids(query: string, overrides: Partial<typeof base> = {}): string[] {
  return filterInbox({ ...base, ...overrides, query }).map((c) => c.id);
}

describe("filterInbox", () => {
  it("recherche vide ou blanche → toute l’inbox triée", () => {
    expect(ids("")).toEqual(["team", "dm", "renamed"]);
    expect(ids("   ")).toEqual(["team", "dm", "renamed"]);
  });

  it("garde le tri favoris en tête", () => {
    expect(
      ids("", { chatStates: { club2_renamed: makeChatState({ favorite: true }) } }),
    ).toEqual(["renamed", "team", "dm"]);
  });

  it("filtre sur le titre, sans casse ni espaces autour", () => {
    expect(ids("  u13 ")).toEqual(["team"]);
  });

  it("titre override prioritaire sur le titre d’origine", () => {
    expect(ids("bureau")).toEqual(["renamed"]);
    expect(ids("staff")).toEqual([]);
  });

  it("DM : nom du pair depuis l’annuaire inbox", () => {
    expect(ids("léa")).toEqual(["dm"]);
  });

  it("filtre sur le nom du club et l’aperçu du dernier message", () => {
    expect(ids("fc nord")).toEqual(["renamed"]);
    expect(ids("as viro")).toEqual(["team", "dm"]);
    expect(ids("annulé")).toEqual(["team"]);
  });

  it("aucune correspondance → liste vide", () => {
    expect(ids("zzz")).toEqual([]);
  });
});
