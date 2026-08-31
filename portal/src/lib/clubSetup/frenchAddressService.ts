/** Suggestion d’adresse française (API Géoplateforme / BAN). */
export type FrenchAddressSuggestion = {
  label: string;
  city: string;
  postalCode: string;
  street: string;
  isSportsVenue: boolean;
};

const HOST = "https://data.geopf.fr";
const SEARCH_PATH = "/geocodage/search";
const MAX_SUGGESTIONS = 8;

const VENUE_SEED_QUERIES = [
  "gymnase",
  "stade",
  "piscine",
  "dojo",
  "omnisport",
] as const;

const SPORT_TOKENS = [
  "gymnase",
  "stade",
  "piscine",
  "dojo",
  "tennis",
  "omnisport",
  "hippodrome",
  "patinoire",
  "golf",
  "equestre",
  "équestre",
  "escalade",
  "baignade",
  "cyclisme",
  "salle d'armes",
  "boulodrome",
  "sportif",
  "sports",
  "handball",
  "football",
  "rugby",
  "volleyball",
  "basketball",
  "judo",
  "escrime",
  "aviron",
  "natation",
  "athlétisme",
] as const;

const venueCache = new Map<string, FrenchAddressSuggestion[]>();

function firstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return "";
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.map((item) => String(item));
  return [];
}

function matchesSportTokens(haystack: string): boolean {
  const normalized = haystack.toLowerCase();
  return SPORT_TOKENS.some((token) => {
    const pattern = new RegExp(
      `(^|[^a-zà-ÿ])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zà-ÿ]|$)`,
      "iu",
    );
    return pattern.test(normalized);
  });
}

function uniqueByLabel(
  suggestions: FrenchAddressSuggestion[],
  maxCount = MAX_SUGGESTIONS,
): FrenchAddressSuggestion[] {
  const seen = new Set<string>();
  const unique: FrenchAddressSuggestion[] = [];
  for (const suggestion of suggestions) {
    if (seen.has(suggestion.label)) continue;
    seen.add(suggestion.label);
    unique.push(suggestion);
    if (unique.length >= maxCount) break;
  }
  return unique;
}

async function searchAddresses(params: {
  query: string;
  index?: string;
  type?: string;
  postcode?: string;
  city?: string;
  labelBuilder: (city: string, postalCode: string, street: string) => string;
}): Promise<FrenchAddressSuggestion[]> {
  const trimmed = params.query.trim();
  if (trimmed.length < 3) return [];

  const searchParams = new URLSearchParams({
    q: trimmed,
    limit: String(MAX_SUGGESTIONS),
    autocomplete: "1",
    index: params.index ?? "address",
  });
  if (params.type) searchParams.set("type", params.type);
  if (params.postcode) searchParams.set("postcode", params.postcode);
  if (params.city) searchParams.set("city", params.city);

  try {
    const response = await fetch(`${HOST}${SEARCH_PATH}?${searchParams.toString()}`);
    if (!response.ok) return [];

    const body = (await response.json()) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    const features = body.features ?? [];
    const isPoi = (params.index ?? "address") === "poi";
    const suggestions: FrenchAddressSuggestion[] = [];

    for (const feature of features) {
      const properties = feature.properties ?? {};
      const suggestionCity = firstString(
        properties.city ?? properties.municipality,
      );
      const suggestionPostal = firstString(properties.postcode);
      const featureType = firstString(properties.type);
      const toponym = firstString(properties.toponym ?? properties.toponyme);
      const name = firstString(properties.name);
      const categories = stringList(properties.category).join(" ");
      const street =
        featureType === "municipality"
          ? ""
          : isPoi
            ? name || toponym
            : name;

      if (isPoi && !matchesSportTokens(`${categories} ${toponym} ${name}`)) {
        continue;
      }

      const label = params
        .labelBuilder(suggestionCity, suggestionPostal, street)
        .trim();
      if (!label) continue;

      suggestions.push({
        label,
        city: suggestionCity,
        postalCode: suggestionPostal,
        street,
        isSportsVenue: isPoi,
      });
    }

    return uniqueByLabel(suggestions);
  } catch {
    return [];
  }
}

async function searchSportsVenues(params: {
  query: string;
  city: string;
  postcode: string;
}): Promise<FrenchAddressSuggestion[]> {
  if (params.query.length < 3) {
    const cacheKey = `${params.city}|${params.postcode}`;
    const cached = venueCache.get(cacheKey);
    if (cached) return cached;

    const batches = await Promise.all(
      VENUE_SEED_QUERIES.map((seed) =>
        searchAddresses({
          query: seed,
          index: "poi",
          postcode: params.postcode,
          city: params.city,
          labelBuilder: (_, __, street) => street,
        }),
      ),
    );
    const venues = uniqueByLabel(batches.flat());
    venueCache.set(cacheKey, venues);
    return venues;
  }

  return searchAddresses({
    query: params.query,
    index: "poi",
    postcode: params.postcode,
    city: params.city,
    labelBuilder: (_, __, street) => street,
  });
}

/** Recherche des communes correspondant à [query] (min. 3 caractères). */
export async function searchFrenchCities(
  query: string,
): Promise<FrenchAddressSuggestion[]> {
  return searchAddresses({
    query,
    type: "municipality",
    labelBuilder: (city, postalCode) => {
      if (!city) return "";
      if (!postalCode) return city;
      return `${city} (${postalCode})`;
    },
  });
}

/** Recherche rues / lieux sportifs dans une commune. */
export async function searchFrenchStreets(params: {
  query: string;
  city: string;
  postalCode?: string;
}): Promise<FrenchAddressSuggestion[]> {
  const cityName = params.city.trim();
  if (!cityName) return [];

  const trimmed = params.query.trim();
  const postcode = params.postalCode?.trim() ?? "";
  const venues = await searchSportsVenues({
    query: trimmed,
    city: cityName,
    postcode,
  });
  const streets =
    trimmed.length < 3
      ? []
      : await searchAddresses({
          query: trimmed,
          postcode,
          city: cityName,
          labelBuilder: (_, __, street) => street,
        });

  return uniqueByLabel([...venues, ...streets], MAX_SUGGESTIONS);
}
