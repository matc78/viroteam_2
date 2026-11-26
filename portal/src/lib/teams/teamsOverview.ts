import type { TeamOption } from "@/lib/firebase/eventService";
import { groupTeamsByCategory } from "@/lib/firebase/teamService";
import { sortTeamCategories } from "@/lib/teams/compareTeamCategories";
import {
  assignTeamCategoryTones,
  type TeamCategoryPaletteTone,
} from "@/lib/teams/teamCategoryTone";

/** Problème d’effectif signalé à l’admin sur une équipe. */
export type TeamHealthIssue = "noCoach" | "noPlayer";

/** Valeur de filtre catégorie : toutes, une catégorie, ou « sans catégorie ». */
export const ALL_CATEGORIES = "all";
export const NO_CATEGORY = "__none__";

/** Libellé affiché pour une équipe sans catégorie. */
export const NO_CATEGORY_LABEL = "Sans catégorie";

/** Chiffres clés de la page Équipes. */
export type TeamsOverview = {
  teamCount: number;
  /** Joueurs distincts (un joueur dans deux équipes compte une fois). */
  playerCount: number;
  /** Coachs distincts. */
  coachCount: number;
  noCoachCount: number;
  noPlayerCount: number;
  /** Équipes ayant au moins un problème d’effectif. */
  incompleteCount: number;
};

/** Filtres de la liste bureau. */
export type TeamsListFilter = {
  search: string;
  category: string;
  onlyIncomplete: boolean;
};

/** Ligne de la liste : équipe, alertes, membres trouvés par la recherche. */
export type TeamListEntry = {
  team: TeamOption;
  issues: TeamHealthIssue[];
  /** Noms de joueurs / coachs correspondant à la recherche (vide sinon). */
  matchedMemberNames: string[];
};

/** Groupe de lignes par catégorie (ordre alphabétique FR). */
export type TeamListGroup = {
  category: string;
  entries: TeamListEntry[];
};

/** Normalise pour une recherche insensible à la casse et aux accents. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Problèmes d’effectif d’une équipe (sans coach, sans joueur). */
export function teamHealthIssues(team: TeamOption): TeamHealthIssue[] {
  const issues: TeamHealthIssue[] = [];
  if (team.coachIds.length === 0) issues.push("noCoach");
  if (team.playerIds.length === 0) issues.push("noPlayer");
  return issues;
}

/** Calcule les chiffres clés et les alertes de la page Équipes. */
export function summarizeTeams(teams: TeamOption[]): TeamsOverview {
  const players = new Set<string>();
  const coaches = new Set<string>();
  let noCoachCount = 0;
  let noPlayerCount = 0;
  let incompleteCount = 0;
  for (const team of teams) {
    team.playerIds.forEach((id) => players.add(id));
    team.coachIds.forEach((id) => coaches.add(id));
    const issues = teamHealthIssues(team);
    if (issues.includes("noCoach")) noCoachCount += 1;
    if (issues.includes("noPlayer")) noPlayerCount += 1;
    if (issues.length > 0) incompleteCount += 1;
  }
  return {
    teamCount: teams.length,
    playerCount: players.size,
    coachCount: coaches.size,
    noCoachCount,
    noPlayerCount,
    incompleteCount,
  };
}

/** Option du filtre catégorie, avec le nombre d’équipes concernées. */
export type TeamCategoryFilterOption = {
  value: string;
  label: string;
  count: number;
};

/**
 * Options du filtre catégorie : Toutes, catégories dans l’ordre naturel
 * (catalogue du sport, puis M7 avant M11), Sans catégorie en dernier si utile.
 */
export function teamCategoryFilterOptions(
  teams: TeamOption[],
  sport?: string,
): TeamCategoryFilterOption[] {
  const counts = new Map<string, number>();
  let uncategorized = 0;
  for (const team of teams) {
    const category = team.category.trim();
    if (!category) uncategorized += 1;
    else counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const categories = sortTeamCategories(counts.keys(), sport);
  return [
    { value: ALL_CATEGORIES, label: "Toutes", count: teams.length },
    ...categories.map((category) => ({
      value: category,
      label: category,
      count: counts.get(category) ?? 0,
    })),
    ...(uncategorized > 0
      ? [{ value: NO_CATEGORY, label: NO_CATEGORY_LABEL, count: uncategorized }]
      : []),
  ];
}

/**
 * Ton de chaque catégorie du club (libellé affiché → ton), attribué dans
 * l’ordre des puces de la page Équipes : une catégorie garde la même
 * couleur sur toutes les vues équipes, deux catégories n’en partagent pas.
 */
export function clubTeamCategoryTones(
  teams: TeamOption[],
  sport?: string,
): Map<string, TeamCategoryPaletteTone> {
  return assignTeamCategoryTones(
    teamCategoryFilterOptions(teams, sport)
      .filter((option) => option.value !== ALL_CATEGORIES)
      .map((option) =>
        option.value === NO_CATEGORY ? NO_CATEGORY_LABEL : option.value,
      ),
  );
}

/** Ton d’une catégorie (libellé affiché ou vide) dans [tones]. */
export function teamCategoryToneOf(
  tones: ReadonlyMap<string, TeamCategoryPaletteTone>,
  categoryLabel: string,
): TeamCategoryPaletteTone {
  return tones.get(categoryLabel.trim() || NO_CATEGORY_LABEL) ?? "slate";
}

/**
 * Pastille courte d’une équipe (2–3 caractères) : initiales des mots du nom
 * qui ne répètent pas la catégorie, nombres gardés entiers.
 * « M11 Benjamins A » (M11) → « BA », « Loisir Mixte 1 » (Loisir) → « M1 ».
 */
export function teamMonogram(name: string, category: string): string {
  const categoryWords = new Set(
    normalizeSearchText(category).split(/\s+/).filter(Boolean),
  );
  const allWords = name.trim().split(/\s+/).filter(Boolean);
  const distinctWords = allWords.filter(
    (word) => !categoryWords.has(normalizeSearchText(word)),
  );
  const source = distinctWords.length > 0 ? distinctWords : allWords;
  const monogram = source
    .slice(0, 2)
    .map((word) => (/^\d+$/.test(word) ? word : word.charAt(0).toUpperCase()))
    .join("")
    .slice(0, 3);
  return monogram || "?";
}

/**
 * Filtre les équipes (catégorie, « à compléter », recherche sur nom,
 * catégorie, joueurs et coachs) puis les groupe par catégorie.
 * `memberNames` : id de fiche → nom affiché.
 */
export function buildTeamListGroups(
  teams: TeamOption[],
  filter: TeamsListFilter,
  memberNames: ReadonlyMap<string, string>,
  sport?: string,
): TeamListGroup[] {
  const needle = normalizeSearchText(filter.search);
  const entriesById = new Map<string, TeamListEntry>();

  for (const team of teams) {
    const category = team.category.trim();
    if (filter.category === NO_CATEGORY && category) continue;
    if (
      filter.category !== ALL_CATEGORIES &&
      filter.category !== NO_CATEGORY &&
      category !== filter.category
    ) {
      continue;
    }
    const issues = teamHealthIssues(team);
    if (filter.onlyIncomplete && issues.length === 0) continue;

    let matchedMemberNames: string[] = [];
    if (needle) {
      const teamMatches =
        normalizeSearchText(team.name).includes(needle) ||
        normalizeSearchText(category).includes(needle);
      matchedMemberNames = [...new Set([...team.coachIds, ...team.playerIds])]
        .map((id) => memberNames.get(id))
        .filter(
          (name): name is string =>
            Boolean(name) && normalizeSearchText(name as string).includes(needle),
        )
        .sort((a, b) => a.localeCompare(b, "fr"));
      if (!teamMatches && matchedMemberNames.length === 0) continue;
    }

    entriesById.set(team.id, { team, issues, matchedMemberNames });
  }

  const visibleTeams = teams.filter((team) => entriesById.has(team.id));
  const groups = groupTeamsByCategory(visibleTeams);
  const order = sortTeamCategories(
    groups
      .map((group) => group.category)
      .filter((category) => category !== NO_CATEGORY_LABEL),
    sport,
  );
  const rank = new Map(order.map((category, index) => [category, index]));
  return groups
    .sort(
      (a, b) =>
        (rank.get(a.category) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.category) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((group) => ({
      category: group.category,
      entries: group.teams.map((team) => entriesById.get(team.id)!),
    }));
}
