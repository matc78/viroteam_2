/** Tons dashboard utilisés pour colorer les catégories d’équipe. */
export type TeamCategoryTone =
  | "blue"
  | "green"
  | "amber"
  | "orange"
  | "cyan"
  | "violet";

const CATEGORY_TONES: readonly TeamCategoryTone[] = [
  "blue",
  "green",
  "amber",
  "orange",
  "cyan",
  "violet",
] as const;

function hashCategoryKey(key: string): number {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/**
 * Associe une catégorie à un ton stable (même label = même couleur).
 * « Sans catégorie » / vide → blue.
 */
export function teamCategoryTone(category: string): TeamCategoryTone {
  const key = category.trim().toLowerCase();
  if (!key || key === "sans catégorie") return "blue";
  return CATEGORY_TONES[hashCategoryKey(key) % CATEGORY_TONES.length];
}
