import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  memberDirectoryFromDocs,
  participantProfilesEqual,
  profileFromMember,
  profileFromUser,
} from "./participantProfiles";

function doc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

describe("profileFromMember", () => {
  it("reprend nom, rôle et avatar du snapshot", () => {
    assert.deepEqual(
      profileFromMember({
        firstName: " Léa ",
        lastName: "Martin",
        role: "coach",
        snapshot: { displayName: "Léa M.", avatarUrl: "https://a/b.jpg" },
      }),
      {
        firstName: "Léa",
        lastName: "Martin",
        displayName: "Léa M.",
        role: "coach",
        avatarUrl: "https://a/b.jpg",
      },
    );
  });

  it("sans snapshot ni avatar : nom composé, pas de clé avatarUrl", () => {
    const profile = profileFromMember({ firstName: "Paul", lastName: "Durand" });
    assert.equal(profile.displayName, "Paul Durand");
    assert.equal(profile.role, "player");
    assert.equal("avatarUrl" in profile, false);
  });
});

describe("profileFromUser", () => {
  it("participant sans fiche = parent", () => {
    assert.deepEqual(profileFromUser({ firstName: "Sam", displayName: "" }), {
      firstName: "Sam",
      lastName: "",
      displayName: "Sam",
      role: "parent",
    });
  });
});

describe("memberDirectoryFromDocs", () => {
  it("indexe par uid Auth et ignore les fiches sans compte", () => {
    const directory = memberDirectoryFromDocs([
      doc("m1", { accountUid: "u1", firstName: "A", role: "player" }),
      doc("m2", { userId: "u2", firstName: "B", role: "coach" }),
      doc("m3", { firstName: "C" }),
    ]);
    assert.deepEqual([...directory.keys()], ["u1", "u2"]);
    assert.equal(directory.get("u2")?.role, "coach");
  });

  it("la fiche active l’emporte sur l’archivée, quel que soit l’ordre", () => {
    const archived = doc("old", {
      accountUid: "u1",
      role: "player",
      status: "archived",
    });
    const active = doc("new", { accountUid: "u1", role: "coach" });
    assert.equal(
      memberDirectoryFromDocs([archived, active]).get("u1")?.role,
      "coach",
    );
    assert.equal(
      memberDirectoryFromDocs([active, archived]).get("u1")?.role,
      "coach",
    );
  });
});

describe("participantProfilesEqual", () => {
  it("ignore l’ordre des clés et traite absent comme vide", () => {
    assert.equal(
      participantProfilesEqual(
        { u1: { role: "coach", firstName: "A" } },
        { u1: { firstName: "A", role: "coach" } },
      ),
      true,
    );
    assert.equal(participantProfilesEqual(undefined, {}), true);
  });

  it("détecte un changement de nom ou un participant en plus", () => {
    assert.equal(
      participantProfilesEqual({ u1: { firstName: "A" } }, { u1: { firstName: "B" } }),
      false,
    );
    assert.equal(
      participantProfilesEqual({ u1: {} }, { u1: {}, u2: {} }),
      false,
    );
  });
});
