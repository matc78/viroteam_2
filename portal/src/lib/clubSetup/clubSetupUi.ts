import { ClubSports } from "./constants";

/** Couleurs d’accent wizard — tokens CSS alignés ViroColors Flutter. */
export const ClubSetupUi = {
  sportAccents: [
    "var(--color-sport-green)",
    "var(--color-sport-orange)",
    "var(--color-sport-cyan)",
    "var(--color-sport-yellow)",
  ] as const,
  stepProgressColors: [
    "var(--color-sport-green)",
    "var(--color-sport-cyan)",
    "var(--color-sport-orange)",
    "var(--color-sport-yellow)",
    "var(--color-primary-400)",
  ] as const,
  /** Accent marque dérivé du sport (logo / hero récap). */
  sportAccent(sport: string): string {
    const index = ClubSports.all.indexOf(sport as (typeof ClubSports.all)[number]);
    if (index < 0) return "var(--color-primary-600)";
    return ClubSetupUi.sportAccents[index % ClubSetupUi.sportAccents.length];
  },
} as const;
