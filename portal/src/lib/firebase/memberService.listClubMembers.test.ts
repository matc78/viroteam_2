import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeDoc = { id: string; data: () => Record<string, unknown> };

const memberDocs: FakeDoc[] = [];
const invitationDocs: FakeDoc[] = [];
const getDocCalls: string[] = [];

vi.mock("./app", () => ({
  getAppFirestore: () => ({}),
  getFirebaseAuth: () => ({}),
}));

vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  collection: (_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  }),
  doc: (parent: { path?: string }, ...segments: string[]) => ({
    path: [parent.path, ...segments].filter(Boolean).join("/"),
  }),
  query: (ref: { path: string }) => ref,
  limit: () => ({}),
  where: () => ({}),
  getDocs: async (ref: { path: string }) => ({
    docs: ref.path.endsWith("/invitations") ? invitationDocs : memberDocs,
  }),
  getDoc: async (ref: { path: string }) => {
    getDocCalls.push(ref.path);
    return {
      exists: () => true,
      data: () => ({ displayName: "Profil", email: "profil@club.fr" }),
    };
  },
}));

const { listClubMembers } = await import("./memberService");

function memberDoc(id: string, data: Record<string, unknown>): FakeDoc {
  return { id, data: () => data };
}

describe("listClubMembers", () => {
  beforeEach(() => {
    memberDocs.length = 0;
    invitationDocs.length = 0;
    getDocCalls.length = 0;
  });

  it("aucune lecture par membre quand le snapshot est complet", async () => {
    for (let index = 0; index < 50; index += 1) {
      memberDocs.push(
        memberDoc(`m${index}`, {
          role: "player",
          firstName: `Joueur${index}`,
          accountUid: `uid${index}`,
          snapshot: { displayName: `Joueur ${index}`, email: `j${index}@club.fr` },
        }),
      );
    }
    const members = await listClubMembers("club1");
    expect(members).toHaveLength(50);
    expect(getDocCalls).toEqual([]);
    expect(members.every((member) => member.hasLinkedAccount)).toBe(true);
  });

  it("joint les invitations en attente en mémoire", async () => {
    memberDocs.push(
      memberDoc("m1", {
        role: "player",
        firstName: "Léa",
        activeInvitationId: "inv1",
      }),
    );
    invitationDocs.push(
      memberDoc("inv1", { status: "pending", code: "ABC123" }),
    );
    const [member] = await listClubMembers("club1");
    expect(member.pendingInviteCode).toBe("ABC123");
    expect(member.hasLinkedAccount).toBe(false);
    expect(getDocCalls).toEqual([]);
  });

  it("repli users/{uid} seulement si le snapshot n’a pas d’e-mail", async () => {
    memberDocs.push(
      memberDoc("m1", { role: "coach", firstName: "Tom", accountUid: "u1" }),
    );
    const [member] = await listClubMembers("club1");
    expect(getDocCalls).toEqual(["users/u1"]);
    expect(member.email).toBe("profil@club.fr");
  });
});
