import type { PracticeLocation } from "./clubSetupDraft";

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

  headquartersPracticeLocation(params: {
    sport: string;
    address: string;
    postalCode: string;
    city: string;
  }): PracticeLocation {
    const practiceAddress = ClubSetupFormat.headquartersPracticeAddress(params);
    return {
      name: ClubSetupFormat.headquartersPracticeName(params),
      address: practiceAddress || undefined,
    };
  },

  isSameLocation(first: PracticeLocation, second: PracticeLocation): boolean {
    return (
      normalize(first.name) === normalize(second.name) &&
      normalize(first.address ?? "") === normalize(second.address ?? "")
    );
  },

  isHeadquartersLocation(params: {
    address: string;
    postalCode: string;
    city: string;
    sport: string;
    location: PracticeLocation;
  }): boolean {
    return ClubSetupFormat.isSameLocation(
      params.location,
      ClubSetupFormat.headquartersPracticeLocation(params),
    );
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
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
