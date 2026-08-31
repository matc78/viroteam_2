import { ClubObjectives } from "./constants";

/** Symbole compact par objectif club (équivalent icônes Phosphor mobile). */
export function clubObjectiveSymbol(key: string): string {
  switch (key) {
    case ClubObjectives.planning:
      return "📅";
    case ClubObjectives.attendance:
      return "✓";
    case ClubObjectives.fees:
      return "€";
    case ClubObjectives.equipment:
      return "⚽";
    case ClubObjectives.communication:
      return "🔔";
    case ClubObjectives.members:
      return "👥";
    case ClubObjectives.teams:
      return "🏟";
    case ClubObjectives.documents:
      return "📄";
    case ClubObjectives.parents:
      return "👨‍👩‍👧";
    case ClubObjectives.stats:
      return "🏆";
    default:
      return "✓";
  }
}
