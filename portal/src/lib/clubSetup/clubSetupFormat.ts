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

  headquartersPracticeAddress(params: {
    address: string;
    postalCode: string;
    city: string;
  }): string {
    const street = params.address.trim();
    const postal = params.postalCode.trim();
    const cityName = params.city.trim();

    if (street) {
      const cityPart = [postal, cityName].filter(Boolean).join(" ");
      return [street, cityPart].filter(Boolean).join(", ");
    }
    if (postal && cityName) return `${postal} ${cityName}`;
    return cityName || postal;
  },

  venueTypeForSport(sport: string): string {
    switch (sport) {
      case "Football":
      case "Rugby":
      case "Athlétisme":
        return "Stade";
      case "Basketball":
      case "Volleyball":
      case "Handball":
        return "Gymnase";
      case "Tennis":
        return "Court";
      case "Natation":
        return "Piscine";
      case "Judo":
        return "Dojo";
      case "Escrime":
        return "Salle d'armes";
      case "Aviron":
        return "Base nautique";
      default:
        return "Gymnase";
    }
  },

  headquartersPracticeName(params: { sport: string; city: string }): string {
    const venue = ClubSetupFormat.venueTypeForSport(params.sport);
    const cityName = params.city.trim();
    return cityName ? `${venue} — ${cityName}` : venue;
  },

  /** Libellé d’un lieu manuel (catégorie + ville). */
  practiceLocationName(params: {
    category: string;
    city: string;
    categoryCustom?: string;
  }): string {
    const categoryLabel = PracticeLocationCategories.label(
      params.category,
      params.categoryCustom,
    );
    const cityName = params.city.trim();
    return cityName ? `${categoryLabel} — ${cityName}` : categoryLabel;
  },

  headquartersPracticeLocation(params: {
    sport: string;
    address: string;
    postalCode: string;
    city: string;
  }): PracticeLocation {
    const practiceAddress = ClubSetupFormat.headquartersPracticeAddress(params);
    const cityName = params.city.trim();
    return {
      name: ClubSetupFormat.headquartersPracticeName(params),
      city: cityName || undefined,
      address: practiceAddress || undefined,
      category: PracticeLocationCategories.defaultForSport(params.sport),
      linkedToHeadquarters: true,
    };
  },

  isSameLocation(first: PracticeLocation, second: PracticeLocation): boolean {
    return (
      normalize(first.name) === normalize(second.name) &&
      normalize(first.city ?? "") === normalize(second.city ?? "") &&
      normalize(first.address ?? "") === normalize(second.address ?? "") &&
      normalize(first.category ?? "") === normalize(second.category ?? "") &&
      normalize(first.categoryCustom ?? "") ===
        normalize(second.categoryCustom ?? "")
    );
  },

  /** Compare deux listes de lieux (ordre, contenu et lien siège). */
  areSameLocations(
    first: PracticeLocation[],
    second: PracticeLocation[],
  ): boolean {
    if (first.length !== second.length) return false;
    return first.every((location, index) => {
      const other = second[index];
      return (
        other != null &&
        ClubSetupFormat.isSameLocation(location, other) &&
        Boolean(location.linkedToHeadquarters) ===
          Boolean(other.linkedToHeadquarters)
      );
    });
  },

  linkedHeadquartersIndex(locations: PracticeLocation[]): number {
    return locations.findIndex((location) => location.linkedToHeadquarters);
  },

  isHeadquartersLocation(params: {
    address: string;
    postalCode: string;
    city: string;
    sport: string;
    location: PracticeLocation;
  }): boolean {
    if (params.location.linkedToHeadquarters) return true;
    const expected = ClubSetupFormat.headquartersPracticeLocation(params);
    // Legacy : même nom + même adresse (city/category optionnels absents OK).
    // On exige l’adresse des deux côtés pour ne pas confondre un lieu manuel
    // « Stade — Lyon » sans lien siège.
    if (normalize(params.location.name) !== normalize(expected.name)) {
      return false;
    }
    const locationAddress = params.location.address?.trim() ?? "";
    const expectedAddress = expected.address?.trim() ?? "";
    if (!locationAddress || !expectedAddress) return false;
    return normalize(locationAddress) === normalize(expectedAddress);
  },

  headquartersLocationIndex(params: {
    address: string;
    postalCode: string;
    city: string;
    sport: string;
    locations: PracticeLocation[];
  }): number {
    return params.locations.findIndex((location) =>
      ClubSetupFormat.isHeadquartersLocation({ ...params, location }),
    );
  },

  /**
   * Migre les lieux legacy : pose `linkedToHeadquarters` sur le siège détecté.
   * Les lieux manuels au même libellé ne sont pas touchés s’ils n’ont pas le flag.
   */
  migrateLinkedHeadquarters(params: {
    address: string;
    postalCode: string;
    city: string;
    sport: string;
    locations: PracticeLocation[];
  }): PracticeLocation[] {
    if (ClubSetupFormat.linkedHeadquartersIndex(params.locations) >= 0) {
      return params.locations;
    }
    const legacyIndex = ClubSetupFormat.headquartersLocationIndex(params);
    if (legacyIndex < 0) return params.locations;
    return params.locations.map((location, index) =>
      index === legacyIndex
        ? { ...location, linkedToHeadquarters: true }
        : location,
    );
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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

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
