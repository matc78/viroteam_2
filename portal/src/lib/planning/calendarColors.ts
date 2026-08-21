/** Palette agenda élargie (teintes bien distinctes, style Google Calendar). */
export const CALENDAR_FILTER_COLORS = [
  "#039be5", // bleu vif
  "#33b679", // vert menthe
  "#f4511e", // orange brûlé
  "#f6bf26", // jaune
  "#d50000", // rouge
  "#8e24aa", // violet
  "#0b8043", // vert forêt
  "#e67c73", // corail
  "#3f51b5", // indigo
  "#ff7043", // orange clair
  "#00897b", // teal
  "#c2185b", // rose foncé
  "#7cb342", // vert lime
  "#5c6bc0", // bleu lavande
  "#fb8c00", // ambre
  "#6d4c41", // brun
  "#00acc1", // cyan
  "#ab47bc", // magenta
  "#43a047", // vert
  "#ef5350", // rouge clair
  "#3949ab", // bleu roi
  "#f9a825", // or
  "#26a69a", // vert d'eau
  "#ec407a", // rose
  "#5e35b1", // violet profond
  "#8d6e63", // taupe
  "#29b6f6", // bleu ciel
  "#9ccc65", // vert clair
  "#ff5722", // orange profond
  "#7e57c2", // violet doux
] as const;

/** Préfixes de clé pour stabiliser les couleurs par type de filtre. */
export type FilterColorKind = "team" | "coach" | "category" | "player";

/**
 * Hash stable d'une chaîne (FNV-1a 32 bits) pour mieux répartir
 * les teintes entre filtres proches lexicalement.
 */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Construit la clé de couleur d'un filtre. */
export function filterColorKey(kind: FilterColorKind, id: string): string {
  return `${kind}:${id}`;
}

/** Couleur déterministe pour une clé de filtre. */
export function colorForFilterKey(key: string): string {
  const index = hashString(key) % CALENDAR_FILTER_COLORS.length;
  return CALENDAR_FILTER_COLORS[index] ?? CALENDAR_FILTER_COLORS[0];
}

/** Couleur d'un filtre (équipe, coach, catégorie, joueur). */
export function colorForFilter(kind: FilterColorKind, id: string): string {
  return colorForFilterKey(filterColorKey(kind, id));
}

/**
 * Couleurs uniques pour une liste d'ids (ordre d’apparition conservé,
 * pour des teintes distinctes entre filtres voisins dans la sidebar).
 */
export function colorsForFilterIds(ids: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  let index = 0;
  for (const id of ids) {
    if (!id || result.has(id)) continue;
    result.set(
      id,
      CALENDAR_FILTER_COLORS[index % CALENDAR_FILTER_COLORS.length] ??
        CALENDAR_FILTER_COLORS[0],
    );
    index += 1;
  }
  return result;
}

/** Résout une couleur depuis une map, avec repli hash déterministe. */
export function resolveFilterColor(
  kind: FilterColorKind,
  id: string,
  paletteById?: ReadonlyMap<string, string>,
): string {
  return paletteById?.get(id) ?? colorForFilter(kind, id);
}
