import { describe, expect, it } from "vitest";
import {
  canProceedIdentity,
  canProceedInfo,
  canProceedObjectives,
  createEmptyClubSetupDraft,
  deserializeClubSetupDraft,
  serializeClubSetupDraft,
} from "./clubSetupDraft";
import {
  ClubMemberCountRanges,
  ClubObjectives,
  ClubSetupSteps,
} from "./constants";

describe("clubSetupDraft validation", () => {
  it("exige nom et sport pour l’identité", () => {
    const draft = createEmptyClubSetupDraft();
    expect(canProceedIdentity(draft)).toBe(false);

    draft.name = "Viro Volley";
    expect(canProceedIdentity(draft)).toBe(true);
  });

  it("exige au moins un objectif", () => {
    const draft = createEmptyClubSetupDraft();
    expect(canProceedObjectives(draft)).toBe(false);
    draft.objectives.add(ClubObjectives.planning);
    expect(canProceedObjectives(draft)).toBe(true);
  });

  it("exige ville et lieu de pratique", () => {
    const draft = createEmptyClubSetupDraft();
    draft.city = "Paris";
    expect(canProceedInfo(draft)).toBe(false);
    draft.practiceLocations.push({ name: "Gymnase municipal" });
    expect(canProceedInfo(draft)).toBe(true);
  });
});

describe("clubSetupDraft serialization", () => {
  it("round-trip JSON + wizardVersion", () => {
    const draft = createEmptyClubSetupDraft();
    draft.name = "Test Club";
    draft.objectives.add(ClubObjectives.fees);
    draft.currentStep = ClubSetupSteps.objectives;
    draft.memberCountRange = ClubMemberCountRanges.range30to100;

    const serialized = serializeClubSetupDraft(draft);
    const restored = deserializeClubSetupDraft(serialized, null);

    expect(restored.name).toBe("Test Club");
    expect(restored.objectives.has(ClubObjectives.fees)).toBe(true);
    expect(restored.currentStep).toBe(ClubSetupSteps.objectives);
    expect(restored.memberCountRange).toBe(ClubMemberCountRanges.range30to100);
  });

  it("normalise les anciennes étapes wizard v1", () => {
    const restored = deserializeClubSetupDraft(
      {
        name: "",
        sport: "Football",
        hasLogo: false,
        objectives: [],
        city: "",
        postalCode: "",
        address: "",
        practiceLocations: [],
        description: "",
        currentStep: 3,
        memberCountRange: null,
        brandColorHex: "#134A7D",
        wizardVersion: 1,
      },
      null,
    );
    expect(restored.currentStep).toBe(ClubSetupSteps.objectives);
  });
});

describe("ClubObjectives labels", () => {
  it("expose les libellés mobile", () => {
    expect(ClubObjectives.label(ClubObjectives.planning)).toBe(
      "Planning & événements",
    );
    expect(ClubMemberCountRanges.recapLabel(ClubMemberCountRanges.over300)).toBe(
      "Plus de 300 membres",
    );
  });
});
