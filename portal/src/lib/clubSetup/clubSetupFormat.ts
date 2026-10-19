import type { PracticeLocation } from "./clubSetupDraft";
import { PracticeLocationCategories } from "./constants";

/** Formatage adresse / lieu pour le wizard création club. */
export const ClubSetupFormat = {
  headquartersLine(params: {
    address: string;
    postalCode: string;
    city: string;
  }): string {
    const street = params.address.trim();
    const postal = params.postalCode.trim();
    const cityName = params.city.trim();

    if (street) {
      const cityLine = [postal, cityName].filter(Boolean).join(" ");
      if (!cityLine) return street;
      return `${street}\n${cityLine}`;
    }
    if (postal && cityName) return `${postal} ${cityName}`;
    if (cityName) return cityName;
    return postal;
  },

  /** Résumé court des lieux ajoutés, ex. « 1 city-stade · 1 forêt à Lyon ». */
  practiceLocationsSummary(params: {
    locations: PracticeLocation[];
    fallbackCity?: string;
  }): string {
    const locations = params.locations;
    if (locations.length <= 0) return "";

    const counts = new Map<string, number>();
    for (const location of locations) {
      const label = PracticeLocationCategories.label(
        location.category ?? PracticeLocationCategories.other,
        location.categoryCustom,
      );
      const key = label.trim() || PracticeLocationCategories.labels.other;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const categoryParts = [...counts.entries()].map(([label, count]) =>
      count > 1
        ? `${count} ${pluralizeCategoryLabel(label)}`
        : `${count} ${label.toLowerCase()}`,
    );

    const cities = [
      ...new Set(
        locations
          .map((location) => location.city?.trim() || "")
          .filter(Boolean),
      ),
    ];
    const cityName =
      cities.length === 1
        ? cities[0]
        : cities.length === 0
          ? params.fallbackCity?.trim() || ""
          : "";

    const head = categoryParts.join(" · ");
    if (cityName) return `${head} à ${cityName}`;
    if (cities.length > 1) return `${head} · ${cities.join(", ")}`;
    return head;
  },
};

function pluralizeCategoryLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  switch (normalized) {
    case "city-stade":
      return "city-stades";
    case "parcours santé":
      return "parcours santé";
    case "piste d'athlétisme":
      return "pistes d'athlétisme";
    case "salle d'armes":
      return "salles d'armes";
    case "base nautique":
      return "bases nautiques";
    case "court de tennis":
      return "courts de tennis";
    case "autre":
      return "autres";
    default:
      if (normalized.endsWith("s") || normalized.endsWith("x")) {
        return normalized;
      }
      return `${normalized}s`;
  }
}
