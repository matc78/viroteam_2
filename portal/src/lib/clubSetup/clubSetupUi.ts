import { ClubObjectives, ClubSports } from "./constants";

/** Couleurs d’accent wizard — tokens CSS alignés ViroColors Flutter. */
export const ClubSetupUi = {
  sportAccents: [
    "var(--color-sport-green)",
    "var(--color-sport-orange)",
    "var(--color-sport-cyan)",
    "var(--color-sport-yellow)",
  ] as const,
  prerequisiteAccents: [
    "var(--color-sport-green)",
    "var(--color-sport-cyan)",
    "var(--color-sport-orange)",
    "var(--color-sport-yellow)",
    "var(--color-role-admin)",
  ] as const,
  stepProgressColors: [
    "var(--color-sport-green)",
    "var(--color-sport-cyan)",
    "var(--color-sport-orange)",
    "var(--color-sport-yellow)",
    "var(--color-primary-400)",
  ] as const,
  sportAccent(sport: string): string {
    const index = ClubSports.all.indexOf(sport as (typeof ClubSports.all)[number]);
    if (index < 0) return "var(--color-primary-600)";
    return ClubSetupUi.sportAccents[index % ClubSetupUi.sportAccents.length];
  },
  objectiveAccent(key: string): string {
    switch (key) {
      case ClubObjectives.planning:
        return "var(--color-sport-cyan)";
      case ClubObjectives.attendance:
        return "var(--color-sport-green)";
      case ClubObjectives.fees:
        return "var(--color-sport-orange)";
      case ClubObjectives.equipment:
        return "var(--color-sport-yellow)";
      case ClubObjectives.communication:
        return "var(--color-primary-400)";
      case ClubObjectives.members:
        return "var(--color-sport-green)";
      case ClubObjectives.teams:
        return "var(--color-sport-cyan)";
      case ClubObjectives.documents:
        return "var(--color-gray-600)";
      case ClubObjectives.parents:
        return "var(--color-role-parent)";
      case ClubObjectives.stats:
        return "var(--color-sport-orange)";
      default:
        return "var(--color-primary-600)";
    }
  },
} as const;
