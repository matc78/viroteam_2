/** Palette des catégories d’équipe (tokens `--tone-*`). */
export type TeamCategoryPaletteTone =
  | "blue"
  | "green"
  | "amber"
  | "orange"
  | "cyan"
  | "violet"
  | "pink"
  | "indigo"
  | "teal"
  | "lime"
  | "red"
  | "slate";

/**
 * Ordre d’attribution : deux catégories voisines (M11 / M13) reçoivent des
 * teintes éloignées. `slate` (gris) est réservé à « Sans catégorie ».
 */
const PALETTE_ORDER: readonly TeamCategoryPaletteTone[] = [
  "blue",
  "orange",
  "green",
  "violet",
  "amber",
  "cyan",
  "pink",
  "lime",
  "indigo",
  "red",
  "teal",
] as const;

/**
 * Attribue une couleur distincte à chaque catégorie d’un club, dans l’ordre
 * donné (déjà trié) : pas de doublon tant qu’il y a au plus 11 catégories.
 * « Sans catégorie » / vide → `slate`.
 */
export function assignTeamCategoryTones(
  orderedCategories: readonly string[],
): Map<string, TeamCategoryPaletteTone> {
  const tones = new Map<string, TeamCategoryPaletteTone>();
  let index = 0;
  for (const raw of orderedCategories) {
    const category = raw.trim();
    if (tones.has(category)) continue;
    if (!category || category.toLowerCase() === "sans catégorie") {
      tones.set(category, "slate");
      continue;
    }
    tones.set(category, PALETTE_ORDER[index % PALETTE_ORDER.length]);
    index += 1;
  }
  return tones;
}
