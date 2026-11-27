import { describe, expect, it } from "vitest";
import type { TeamOption } from "@/lib/firebase/eventService";
import {
  ALL_CATEGORIES,
  NO_CATEGORY,
  buildTeamListGroups,
  clubTeamCategoryTones,
  normalizeSearchText,
  summarizeTeams,
  teamCategoryFilterOptions,
  teamCategoryToneOf,
  teamHealthIssues,
  teamMonogram,
} from "./teamsOverview";

function team(
  id: string,
  overrides: Partial<TeamOption> = {},
): TeamOption {
  return {
    id,
    name: id,
    category: "",
    playerIds: [],
    coachIds: [],
    sparringIds: [],
    ...overrides,
  };
}

const teams: TeamOption[] = [
  team("u13-f", {
    name: "U13 Filles",
    category: "U13",
    playerIds: ["p1", "p2"],
    coachIds: ["c1"],
  }),
  team("u13-g", { name: "U13 Garçons", category: "U13", playerIds: ["p3"] }),
  team("seniors", {
    name: "Seniors",
    category: "Seniors",
    playerIds: ["p1"],
    coachIds: ["c1"],
  }),
  team("loisir", { name: "Loisir", coachIds: ["c2"] }),
];

const names = new Map([
  ["p1", "Léa Dupont"],
  ["p2", "Hugo Martin"],
  ["p3", "Noé Bernard"],
  ["c1", "Julie Coach"],
  ["c2", "Marc Petit"],
]);

const noFilter = { search: "", category: ALL_CATEGORIES, onlyIncomplete: false };

describe("alertes d’effectif", () => {
  it("signale les équipes sans coach et sans joueur", () => {
    expect(teamHealthIssues(teams[0])).toEqual([]);
    expect(teamHealthIssues(teams[1])).toEqual(["noCoach"]);
    expect(teamHealthIssues(teams[3])).toEqual(["noPlayer"]);
  });

  it("compte joueurs et coachs distincts", () => {
    expect(summarizeTeams(teams)).toEqual({
      teamCount: 4,
      playerCount: 3,
      coachCount: 2,
      noCoachCount: 1,
      noPlayerCount: 1,
      incompleteCount: 2,
    });
  });
});

describe("filtre catégorie", () => {
  it("ajoute « Sans catégorie » seulement si une équipe n’en a pas", () => {
    expect(teamCategoryFilterOptions(teams).map((o) => o.value)).toEqual([
      ALL_CATEGORIES,
      "Seniors",
      "U13",
      NO_CATEGORY,
    ]);
    expect(
      teamCategoryFilterOptions(teams.slice(0, 3)).map((o) => o.value),
    ).not.toContain(NO_CATEGORY);
  });

  it("compte les équipes de chaque catégorie", () => {
    expect(teamCategoryFilterOptions(teams).map((o) => o.count)).toEqual([4, 1, 2, 1]);
  });

  it("filtre par catégorie et sans catégorie", () => {
    const u13 = buildTeamListGroups(teams, { ...noFilter, category: "U13" }, names);
    expect(u13.map((g) => g.category)).toEqual(["U13"]);
    expect(u13[0].entries.map((e) => e.team.id)).toEqual(["u13-f", "u13-g"]);

    const none = buildTeamListGroups(teams, { ...noFilter, category: NO_CATEGORY }, names);
    expect(none.flatMap((g) => g.entries.map((e) => e.team.id))).toEqual(["loisir"]);
  });
});

describe("pastille d’équipe", () => {
  it("retire les mots de la catégorie et garde les nombres", () => {
    expect(teamMonogram("M11 Benjamins A", "M11")).toBe("BA");
    expect(teamMonogram("Loisir Mixte 1", "Loisir")).toBe("M1");
    expect(teamMonogram("Seniors", "Seniors")).toBe("S");
    expect(teamMonogram("équipe première", "")).toBe("ÉP");
  });
});

describe("liste bureau", () => {
  it("groupe par catégorie, « Sans catégorie » en dernier", () => {
    const groups = buildTeamListGroups(teams, noFilter, names);
    expect(groups.map((g) => g.category)).toEqual(["Seniors", "U13", "Sans catégorie"]);
  });

  it("trie les catégories d’âge dans l’ordre naturel", () => {
    const ages = ["M21", "M7", "M11", "M9"].map((category) =>
      team(category, { category }),
    );
    expect(buildTeamListGroups(ages, noFilter, names).map((g) => g.category)).toEqual([
      "M7",
      "M9",
      "M11",
      "M21",
    ]);
    expect(teamCategoryFilterOptions(ages).map((o) => o.value).slice(1)).toEqual([
      "M7",
      "M9",
      "M11",
      "M21",
    ]);
  });

  it("« À compléter » ne garde que les équipes avec une alerte", () => {
    const groups = buildTeamListGroups(teams, { ...noFilter, onlyIncomplete: true }, names);
    expect(groups.flatMap((g) => g.entries.map((e) => e.team.id))).toEqual([
      "u13-g",
      "loisir",
    ]);
  });

  it("recherche un joueur sans accent et remonte son nom", () => {
    const groups = buildTeamListGroups(teams, { ...noFilter, search: "lea" }, names);
    const entries = groups.flatMap((g) => g.entries);
    expect(entries.map((e) => e.team.id)).toEqual(["seniors", "u13-f"]);
    expect(entries[0].matchedMemberNames).toEqual(["Léa Dupont"]);
  });

  it("recherche sur le nom d’équipe sans nom de membre trouvé", () => {
    const groups = buildTeamListGroups(teams, { ...noFilter, search: "garcons" }, names);
    const entries = groups.flatMap((g) => g.entries);
    expect(entries.map((e) => e.team.id)).toEqual(["u13-g"]);
    expect(entries[0].matchedMemberNames).toEqual([]);
  });
});

describe("couleurs de catégorie partagées entre les vues équipes", () => {
  it("donne une couleur distincte par catégorie, gris pour Sans catégorie", () => {
    const clubTeams = [
      team("a", { category: "M13" }),
      team("b", { category: "M11" }),
      team("c", { category: "Seniors" }),
      team("d"),
    ];
    const tones = clubTeamCategoryTones(clubTeams);
    const named = ["M11", "M13", "Seniors"].map((category) =>
      teamCategoryToneOf(tones, category),
    );
    expect(new Set(named).size).toBe(3);
    expect(teamCategoryToneOf(tones, "")).toBe("slate");
    expect(teamCategoryToneOf(tones, "Sans catégorie")).toBe("slate");
  });

  it("ne dépend pas de l’ordre des équipes", () => {
    const clubTeams = [
      team("a", { category: "M13" }),
      team("b", { category: "M11" }),
    ];
    const forward = clubTeamCategoryTones(clubTeams);
    const backward = clubTeamCategoryTones([...clubTeams].reverse());
    expect(teamCategoryToneOf(forward, "M11")).toBe(
      teamCategoryToneOf(backward, "M11"),
    );
  });
});

describe("normalizeSearchText", () => {
  it("ignore accents et casse", () => {
    expect(normalizeSearchText("  Hélène ")).toBe("helene");
  });
});
