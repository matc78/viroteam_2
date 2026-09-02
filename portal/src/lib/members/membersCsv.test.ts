import { describe, expect, it } from "vitest";
import { buildMembersImportPlan } from "./membersCsv";

const HEADER = "firstName,lastName,role,email,license,team,category";

function plan(lines: string[], existingMembers: Parameters<
  typeof buildMembersImportPlan
>[0]["existingMembers"] = []) {
  return buildMembersImportPlan({
    content: [HEADER, ...lines].join("\n"),
    sport: "football",
    existingMembers,
    existingTeams: [],
  });
}

describe("buildMembersImportPlan — e-mail obligatoire", () => {
  it("accepte un fichier où chaque ligne a un e-mail valide (normalisé)", () => {
    const result = plan(["Alice,Dupont,player, Alice@Example.COM ,,,"]);
    expect(result.blockingErrors).toEqual([]);
    expect(result.memberActions).toHaveLength(1);
    expect(result.memberActions[0]?.email).toBe("alice@example.com");
  });

  it("bloque et liste les lignes sans e-mail", () => {
    const result = plan([
      "Alice,Dupont,player,,,,",
      "Bob,Martin,coach,bob@example.com,,,",
      "Chloé,Durand,player,,,,",
    ]);
    expect(result.memberActions).toEqual([]);
    expect(result.blockingErrors.some((e) => e.startsWith("Ligne 2 :"))).toBe(true);
    expect(result.blockingErrors.some((e) => e.startsWith("Ligne 4 :"))).toBe(true);
    expect(
      result.blockingErrors.some((e) => e.includes("lignes 2, 4")),
    ).toBe(true);
  });

  it("bloque un e-mail mal formé", () => {
    const result = plan(["Alice,Dupont,player,pas-un-email,,,"]);
    expect(result.memberActions).toEqual([]);
    expect(result.blockingErrors[0]).toContain("E-mail invalide");
  });

  it("bloque un même e-mail sur deux lignes", () => {
    const result = plan([
      "Alice,Dupont,player,same@example.com,,,",
      "Bob,Martin,coach,SAME@example.com,,,",
    ]);
    expect(result.memberActions).toEqual([]);
    expect(
      result.blockingErrors.some((e) => e.includes("utilisé sur deux lignes")),
    ).toBe(true);
  });

  it("tolère l’absence d’e-mail pour un membre déjà inscrit (compte lié)", () => {
    const result = plan(["Alice,Dupont,player,,,,"], [
      {
        memberId: "m1",
        firstName: "Alice",
        lastName: "Dupont",
        role: "player",
        accountUid: "uid-alice",
      },
    ]);
    expect(result.blockingErrors).toEqual([]);
    expect(result.memberActions[0]?.action).toBe("update");
  });
});
