import { describe, expect, it } from "vitest";
import {
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
