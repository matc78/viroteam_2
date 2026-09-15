import { describe, expect, it } from "vitest";
import {
  computeActivationStats,
  filterActivationRows,
  isMemberNeedingFirstInvite,
} from "./membersView";

describe("computeActivationStats", () => {
  it("répartit linked / pending / à inviter / no email (buckets disjoints)", () => {
    const future = new Date(Date.now() + 86_400_000);
    const past = new Date(Date.now() - 86_400_000);
    const stats = computeActivationStats([
      { hasLinkedAccount: true, email: "a@x.fr" },
      {
        hasLinkedAccount: false,
        email: "b@x.fr",
        pendingInviteCode: "ABC123",
        pendingInviteExpiresAt: future,
      },
      {
        hasLinkedAccount: false,
        email: "c@x.fr",
        pendingInviteCode: "OLD",
        pendingInviteExpiresAt: past,
      },
      { hasLinkedAccount: false, email: null },
    ]);
    expect(stats).toEqual({
      linked: 1,
      pendingInvite: 1,
      withEmailNotLinked: 1,
      noEmail: 1,
      total: 4,
    });
    expect(
      stats.linked +
        stats.pendingInvite +
        stats.withEmailNotLinked +
        stats.noEmail,
    ).toBe(stats.total);
  });
});

describe("filterActivationRows", () => {
  it("filtre le bucket noEmail", () => {
    const rows = [
      { memberId: "1", hasLinkedAccount: false, email: null },
      { memberId: "2", hasLinkedAccount: false, email: "x@y.fr" },
      { memberId: "3", hasLinkedAccount: true, email: null },
    ];
    expect(filterActivationRows(rows, "noEmail").map((r) => r.memberId)).toEqual([
      "1",
    ]);
  });

  it("exclut les invites valides du bucket withEmailNotLinked", () => {
    const future = new Date(Date.now() + 86_400_000);
    const rows = [
      {
        memberId: "pending",
        hasLinkedAccount: false,
        email: "a@x.fr",
        pendingInviteCode: "ABC",
        pendingInviteExpiresAt: future,
      },
      {
        memberId: "needs",
        hasLinkedAccount: false,
        email: "b@x.fr",
        pendingInviteCode: null,
        pendingInviteExpiresAt: null,
      },
    ];
    expect(
      filterActivationRows(rows, "withEmailNotLinked").map((r) => r.memberId),
    ).toEqual(["needs"]);
    expect(
      filterActivationRows(rows, "pendingInvite").map((r) => r.memberId),
    ).toEqual(["pending"]);
  });
});

describe("isMemberNeedingFirstInvite", () => {
  it("refuse un membre déjà en invite valide", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(
      isMemberNeedingFirstInvite({
        hasLinkedAccount: false,
        email: "a@x.fr",
        pendingInviteCode: "ABC",
        pendingInviteExpiresAt: future,
      }),
    ).toBe(false);
    expect(
      isMemberNeedingFirstInvite({
        hasLinkedAccount: false,
        email: "a@x.fr",
        pendingInviteCode: null,
        pendingInviteExpiresAt: null,
      }),
    ).toBe(true);
  });
});
