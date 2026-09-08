import { describe, expect, it } from "vitest";
import {
  canProceedIdentity,
  canProceedInfo,
  canProceedObjectives,
  createEmptyClubSetupDraft,
  deserializeClubSetupDraft,
  serializeClubSetupDraft,
} from "./clubSetupDraft";
import { ClubSetupFormat } from "./clubSetupFormat";
import {
  ClubMemberCountRanges,
  ClubObjectives,
  ClubSetupSteps,
  PracticeLocationCategories,
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
    draft.memberCountRange = "50";
    draft.useClubAddressAsFirstLocation = false;

    const serialized = serializeClubSetupDraft(draft);
    const restored = deserializeClubSetupDraft(serialized, null);

    expect(restored.name).toBe("Test Club");
    expect(restored.objectives.has(ClubObjectives.fees)).toBe(true);
    expect(restored.currentStep).toBe(ClubSetupSteps.objectives);
    expect(restored.maxReachedStep).toBe(ClubSetupSteps.objectives);
    expect(restored.memberCountRange).toBe("50");
    expect(restored.useClubAddressAsFirstLocation).toBe(false);
  });

  it("round-trip PracticeLocation avec linkedToHeadquarters", () => {
    const draft = createEmptyClubSetupDraft();
    draft.practiceLocations = [
      {
        name: "Stade — Lyon",
        city: "Lyon",
        address: "1 rue du Stade, 69000 Lyon",
        category: PracticeLocationCategories.stadium,
        linkedToHeadquarters: true,
      },
      {
        name: "Forêt — Lyon",
        city: "Lyon",
        address: "Bois de la Croix",
        category: PracticeLocationCategories.forest,
      },
    ];

    const restored = deserializeClubSetupDraft(
      serializeClubSetupDraft(draft),
      null,
    );
    expect(restored.practiceLocations).toHaveLength(2);
    expect(restored.practiceLocations[0]?.linkedToHeadquarters).toBe(true);
    expect(restored.practiceLocations[1]?.linkedToHeadquarters).toBeUndefined();
    expect(restored.practiceLocations[1]?.category).toBe(
      PracticeLocationCategories.forest,
    );
  });

  it("conserve maxReachedStep au-delà de currentStep", () => {
    const draft = createEmptyClubSetupDraft();
    draft.currentStep = ClubSetupSteps.identity;
    draft.maxReachedStep = ClubSetupSteps.location;

    const restored = deserializeClubSetupDraft(
      serializeClubSetupDraft(draft),
      null,
    );
    expect(restored.currentStep).toBe(ClubSetupSteps.identity);
    expect(restored.maxReachedStep).toBe(ClubSetupSteps.location);
  });

  it("fallback maxReachedStep = currentStep pour les anciens brouillons", () => {
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
        currentStep: ClubSetupSteps.objectives,
        memberCountRange: null,
        brandColorHex: "#134A7D",
        wizardVersion: 2,
      },
      null,
    );
    expect(restored.maxReachedStep).toBe(ClubSetupSteps.objectives);
    expect(restored.useClubAddressAsFirstLocation).toBe(false);
  });

  it("dérive useClubAddressAsFirstLocation depuis un HQ legacy", () => {
    const hqAddress = ClubSetupFormat.headquartersPracticeAddress({
      address: "12 rue des Lilas",
      postalCode: "69003",
      city: "Lyon",
    });
    const restored = deserializeClubSetupDraft(
      {
        name: "FC Legacy",
        sport: "Football",
        hasLogo: false,
        objectives: [],
        city: "Lyon",
        postalCode: "69003",
        address: "12 rue des Lilas",
        practiceLocations: [
          {
            name: ClubSetupFormat.headquartersPracticeName({
              sport: "Football",
              city: "Lyon",
            }),
            address: hqAddress,
          },
        ],
        description: "",
        currentStep: ClubSetupSteps.location,
        memberCountRange: ClubMemberCountRanges.range30to100,
        brandColorHex: "#134A7D",
        wizardVersion: 2,
      },
      null,
    );
    expect(restored.practiceLocations[0]?.linkedToHeadquarters).toBe(true);
    expect(restored.useClubAddressAsFirstLocation).toBe(true);
    expect(restored.memberCountRange).toBe("50");
  });

  it("ne force pas la case siège si absente du brouillon legacy", () => {
    const restored = deserializeClubSetupDraft(
      {
        name: "Club Manuel",
        sport: "Football",
        hasLogo: false,
        objectives: [],
        city: "Lyon",
        postalCode: "69003",
        address: "12 rue des Lilas",
        practiceLocations: [
          {
            name: "Stade — Lyon",
            city: "Lyon",
            address: "Stade de Gerland",
            category: PracticeLocationCategories.stadium,
          },
        ],
        description: "",
        currentStep: ClubSetupSteps.location,
        memberCountRange: null,
        brandColorHex: "#134A7D",
        wizardVersion: 2,
      },
      null,
    );
    expect(restored.practiceLocations[0]?.linkedToHeadquarters).toBeUndefined();
    expect(restored.useClubAddressAsFirstLocation).toBe(false);
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

describe("ClubSetupFormat headquarters", () => {
  it("ne confond pas un lieu manuel Stade — Ville avec le siège", () => {
    const manual = {
      name: ClubSetupFormat.practiceLocationName({
        category: PracticeLocationCategories.stadium,
        city: "Lyon",
      }),
      city: "Lyon",
      address: "Stade de Gerland",
      category: PracticeLocationCategories.stadium,
    };
    expect(
      ClubSetupFormat.isHeadquartersLocation({
        sport: "Football",
        city: "Lyon",
        postalCode: "69003",
        address: "12 rue des Lilas",
        location: manual,
      }),
    ).toBe(false);
  });

  it("détecte le siège via linkedToHeadquarters uniquement pour le filtrage", () => {
    const locations = [
      {
        name: "Stade — Lyon",
        city: "Lyon",
        address: "Siège",
        linkedToHeadquarters: true,
      },
      {
        name: "Stade — Lyon",
        city: "Lyon",
        address: "Manuel",
        category: PracticeLocationCategories.stadium,
      },
    ];
    const withoutHq = locations.filter(
      (location) => !location.linkedToHeadquarters,
    );
    expect(withoutHq).toHaveLength(1);
    expect(withoutHq[0]?.address).toBe("Manuel");
  });

  it("résume les lieux avec pluriels", () => {
    expect(
      ClubSetupFormat.practiceLocationsSummary({
        locations: [
          {
            name: "a",
            category: PracticeLocationCategories.cityStade,
            city: "Lyon",
          },
          {
            name: "b",
            category: PracticeLocationCategories.cityStade,
            city: "Lyon",
          },
        ],
      }),
    ).toBe("2 city-stades à Lyon");
  });
});

describe("ClubObjectives labels", () => {
  it("expose les libellés mobile", () => {
    expect(ClubObjectives.label(ClubObjectives.planning)).toBe(
      "Planning & événements",
    );
    expect(ClubMemberCountRanges.all[0]).toBe("10");
    expect(ClubMemberCountRanges.all).toContain("100");
    expect(ClubMemberCountRanges.all).toContain("125");
    expect(ClubMemberCountRanges.recapLabel("150")).toBe("150 membres");
    expect(ClubMemberCountRanges.recapLabel(ClubMemberCountRanges.over300)).toBe(
      "Plus de 300 membres",
    );
    expect(
      ClubMemberCountRanges.migratePersisted(ClubMemberCountRanges.under30),
    ).toBe("20");
  });
});
