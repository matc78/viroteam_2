/** Palette agenda (style Google Calendar). */
export const CALENDAR_FILTER_COLORS = [
  "#039be5",
  "#33b679",
  "#f4511e",
  "#f6bf26",
  "#d50000",
  "#0b8043",
  "#3f51b5",
  "#8e24aa",
  "#e67c73",
  "#7986cb",
  "#009688",
  "#616161",
  "#ad1457",
  "#c0ca33",
] as const;

/** Préfixes de clé pour stabiliser les couleurs par type de filtre. */
export type FilterColorKind = "team" | "coach" | "category" | "player";

/** Hash stable d'une chaîne vers un entier positif. */
function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
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
 * Couleur d'affichage d'un événement : priorité à la première équipe,
 * sinon une teinte dérivée du type.
 */
export function colorForEvent(teamIds: string[], eventType: string): string {
  const primaryTeamId = teamIds[0];
  if (primaryTeamId) {
    return colorForFilter("team", primaryTeamId);
  }
  return colorForFilterKey(`type:${eventType}`);
}
