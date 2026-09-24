import { teamCategoriesForSport } from "@/lib/teams/teamCategories";

/**
 * Compare deux libellés de catégorie d’équipe (M7 avant M21, U9 avant U11…).
 * Ordre numérique sur le premier entier trouvé, sinon locale FR.
 */
export function compareTeamCategories(a: string, b: string): number {
  const left = parseCategorySortKey(a);
  const right = parseCategorySortKey(b);
  if (left.prefix !== right.prefix) {
    return left.prefix.localeCompare(right.prefix, "fr", {
      sensitivity: "base",
    });
  }
  if (left.age !== null && right.age !== null && left.age !== right.age) {
    return left.age - right.age;
  }
  if (left.age !== null && right.age === null) return -1;
  if (left.age === null && right.age !== null) return 1;
  return a.localeCompare(b, "fr", { sensitivity: "base" });
}

/**
 * Trie une liste de catégories (copie).
 * Si [sport] est fourni, privilégie l’ordre du catalogue sport.
 */
export function sortTeamCategories(
  categories: Iterable<string>,
  sport?: string,
): string[] {
  const unique = Array.from(
    new Set(
      [...categories]
        .map((category) => category.trim())
        .filter((category) => category.length > 0),
    ),
  );
  if (sport && sport.trim()) {
    const catalog = teamCategoriesForSport(sport);
    const rank = new Map(catalog.map((category, index) => [category, index]));
    unique.sort((a, b) => {
      const ra = rank.get(a);
      const rb = rank.get(b);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return compareTeamCategories(a, b);
    });
    return unique;
  }
  return unique.sort(compareTeamCategories);
}

function parseCategorySortKey(raw: string): {
  prefix: string;
  age: number | null;
} {
  const value = raw.trim();
  const match = value.match(/^([^\d]*?)(\d+)/u);
  if (!match) {
    return { prefix: value.toLowerCase(), age: null };
  }
  return {
    prefix: (match[1] ?? "").toLowerCase(),
    age: Number.parseInt(match[2] ?? "", 10),
  };
}
