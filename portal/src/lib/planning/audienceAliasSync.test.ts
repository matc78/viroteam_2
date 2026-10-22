import { describe, expect, it } from "vitest";
import {
  audienceMapKeys,
  buildAudienceMapsPatch,
  buildCanonicalByAnyId,
  planAudienceSync,
} from "./audienceAliasSync";

describe("planAudienceSync", () => {
  const canonicalByAnyId = buildCanonicalByAnyId([
    { memberId: "mem-a", canonicalId: "uid-a" },
    { memberId: "mem-b", canonicalId: "uid-b" },
  ]);

  it("migre legacy → canonique au lieu d’empiler les deux", () => {
    const plan = planAudienceSync({
      currentMemberIds: ["mem-a", "mem-b"],
      expectedCanonicalIds: ["uid-a", "uid-b"],
      canonicalByAnyId,
    });
    expect(plan.changed).toBe(true);
    expect(new Set(plan.nextMemberIds)).toEqual(new Set(["uid-a", "uid-b"]));
    expect(plan.rsvpDeletes.sort()).toEqual(["mem-a", "mem-b"]);
  });

  it("retire le legacy si les deux ids sont déjà présents", () => {
    const plan = planAudienceSync({
      currentMemberIds: ["mem-a", "uid-a"],
      expectedCanonicalIds: ["uid-a"],
      canonicalByAnyId,
    });
    expect(plan.nextMemberIds).toEqual(["uid-a"]);
    expect(plan.rsvpDeletes).toEqual(["mem-a"]);
  });

  it("conserve un invité manuel hors roster", () => {
    const plan = planAudienceSync({
      currentMemberIds: ["manual-x", "mem-a"],
      expectedCanonicalIds: ["uid-a"],
      canonicalByAnyId,
    });
    expect(new Set(plan.nextMemberIds)).toEqual(
      new Set(["manual-x", "uid-a"]),
    );
  });
});

describe("buildAudienceMapsPatch", () => {
  const DELETE = Symbol("delete");
  const plan = {
    rsvpDeletes: ["mem-a"],
    rsvpMoves: [{ from: "mem-a", to: "uid-a" }],
  };

  it("déplace RSVP, timestamp de vote et vue vers la clé canonique", () => {
    const patch = buildAudienceMapsPatch({
      plan,
      maps: {
        rsvp: { "mem-a": "yes" },
        rsvpUpdatedAt: { "mem-a": "ts" },
        seenAt: { "mem-a": "seen" },
      },
      deleteField: DELETE,
    });
    expect(patch).toEqual({
      "rsvp.uid-a": "yes",
      "rsvp.mem-a": DELETE,
      "rsvpUpdatedAt.uid-a": "ts",
      "rsvpUpdatedAt.mem-a": DELETE,
      "seenAt.uid-a": "seen",
      "seenAt.mem-a": DELETE,
    });
  });

  it("garde le vote canonique et supprime seulement le timestamp legacy", () => {
    const patch = buildAudienceMapsPatch({
      plan,
      maps: {
        rsvp: { "mem-a": "yes", "uid-a": "no" },
        rsvpUpdatedAt: { "mem-a": "ts" },
        seenAt: { "mem-a": "seen-legacy", "uid-a": "seen" },
      },
      deleteField: DELETE,
    });
    expect(patch).toEqual({
      "rsvp.mem-a": DELETE,
      "rsvpUpdatedAt.mem-a": DELETE,
      "seenAt.mem-a": DELETE,
    });
  });

  it("audienceMapKeys couvre les clés orphelines des trois maps", () => {
    expect(
      audienceMapKeys({
        rsvp: { a: "yes" },
        rsvpUpdatedAt: { b: "ts" },
        seenAt: { a: "seen", c: "seen" },
      }).sort(),
    ).toEqual(["a", "b", "c"]);
  });
});
