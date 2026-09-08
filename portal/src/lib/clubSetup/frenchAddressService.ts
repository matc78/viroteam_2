import * as Sentry from "@sentry/nextjs";

/** Suggestion d’adresse française (GeoPF BAN + Nominatim OSM pour lieux sportifs). */
export type FrenchAddressSuggestion = {
  label: string;
  city: string;
  postalCode: string;
  street: string;
  isSportsVenue: boolean;
};

const GEOPF_HOST = "https://data.geopf.fr";
const GEOPF_SEARCH_PATH = "/geocodage/search";
const MAX_SUGGESTIONS = 8;

const SPORT_OSM_TYPES = new Set([
  "stadium",
  "pitch",
  "sports_centre",
  "sports_hall",
  "fitness_centre",
  "swimming_pool",
  "swimming_area",
  "track",
  "golf_course",
  "horse_riding",
  "ice_rink",
  "climbing",
  "dojo",
  "marina",
  "recreation_ground",
]);

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
  "complexe sportif",
] as const;

const venueCache = new Map<string, FrenchAddressSuggestion[]>();

type NominatimResult = {
  name?: string;
  display_name?: string;
  class?: string;
  type?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
    road?: string;
    suburb?: string;
  };
};

function firstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return "";
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
    const key = suggestion.label.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(suggestion);
    if (unique.length >= maxCount) break;
  }
  return unique;
}

function cityFromNominatim(result: NominatimResult): string {
  const address = result.address;
  if (!address) return "";
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    ""
  );
}

function isSportsOsmResult(result: NominatimResult): boolean {
  const type = (result.type ?? "").toLowerCase();
  const osmClass = (result.class ?? "").toLowerCase();
  const name = (result.name ?? result.display_name ?? "").toLowerCase();
  if (SPORT_OSM_TYPES.has(type)) return true;
  if (
    (osmClass === "leisure" || osmClass === "sport" || osmClass === "amenity") &&
    matchesSportTokens(name)
  ) {
    return true;
  }
  return matchesSportTokens(name);
}

function reportAddressIssue(
  context: string,
  error: unknown,
  level: "error" | "warning" = "warning",
): void {
  const exception =
    error instanceof Error ? error : new Error(String(error ?? context));
  Sentry.captureException(exception, {
    level,
    tags: { feature: "club_setup", area: "address" },
    extra: { context },
  });
}

function mapNominatimResults(
  results: NominatimResult[],
  fallbackCity: string,
): FrenchAddressSuggestion[] {
  const suggestions: FrenchAddressSuggestion[] = [];
  for (const result of results) {
    if (!isSportsOsmResult(result)) continue;
    const name = (result.name || "").trim();
    if (!name) continue;

    const suggestionCity = cityFromNominatim(result) || fallbackCity;
    const suggestionPostal = result.address?.postcode ?? "";
    const road = result.address?.road?.trim() ?? "";
    const label = road ? `${name} — ${road}` : name;

    suggestions.push({
      label,
      city: suggestionCity,
      postalCode: suggestionPostal,
      street: name,
      isSportsVenue: true,
    });
  }
  return uniqueByLabel(suggestions);
}

async function searchGeoPfAddresses(params: {
  query: string;
  type?: string;
  postcode?: string;
  city?: string;
  signal?: AbortSignal;
  labelBuilder: (city: string, postalCode: string, street: string) => string;
}): Promise<FrenchAddressSuggestion[]> {
  const trimmed = params.query.trim();
  if (trimmed.length < 3) return [];

  const searchParams = new URLSearchParams({
    q: trimmed,
    limit: String(MAX_SUGGESTIONS),
    autocomplete: "1",
    index: "address",
  });
  if (params.type) searchParams.set("type", params.type);
  if (params.postcode) searchParams.set("postcode", params.postcode);
  if (params.city) searchParams.set("city", params.city);

  try {
    const response = await fetch(
      `${GEOPF_HOST}${GEOPF_SEARCH_PATH}?${searchParams.toString()}`,
      { signal: params.signal },
    );
    if (!response.ok) {
      reportAddressIssue(`geopf_http_${response.status}`, new Error(response.statusText));
      return [];
    }

    const body = (await response.json()) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    const suggestions: FrenchAddressSuggestion[] = [];

    for (const feature of body.features ?? []) {
      const properties = feature.properties ?? {};
      const suggestionCity = firstString(
        properties.city ?? properties.municipality,
      );
      const suggestionPostal = firstString(properties.postcode);
      const featureType = firstString(properties.type);
      const street = featureType === "municipality" ? "" : firstString(properties.name);
      const label = params
        .labelBuilder(suggestionCity, suggestionPostal, street)
        .trim();
      if (!label) continue;

      suggestions.push({
        label,
        city: suggestionCity,
        postalCode: suggestionPostal,
        street,
        isSportsVenue: false,
      });
    }

    return uniqueByLabel(suggestions);
  } catch (error) {
    if (params.signal?.aborted) return [];
    reportAddressIssue("geopf_fetch", error);
    return [];
  }
}

async function searchNominatimViaProxy(params: {
  city: string;
  query?: string;
  mode?: "search" | "seeds";
  signal?: AbortSignal;
}): Promise<FrenchAddressSuggestion[]> {
  const cityName = params.city.trim();
  if (!cityName) return [];

  const searchParams = new URLSearchParams({ city: cityName });
  if (params.mode === "seeds") {
    searchParams.set("mode", "seeds");
  } else {
    const query = params.query?.trim() ?? "";
    if (query.length < 2) return [];
    searchParams.set("q", query);
  }

  try {
    const response = await fetch(
      `/api/club-setup/nominatim?${searchParams.toString()}`,
      { signal: params.signal },
    );
    if (!response.ok) {
      reportAddressIssue(
        `nominatim_proxy_http_${response.status}`,
        new Error(response.statusText),
      );
      return [];
    }
    const body = (await response.json()) as { results?: NominatimResult[] };
    return mapNominatimResults(body.results ?? [], cityName);
  } catch (error) {
    if (params.signal?.aborted) return [];
    reportAddressIssue("nominatim_proxy_fetch", error);
    return [];
  }
}

async function searchSportsVenues(params: {
  query: string;
  city: string;
  postcode: string;
  signal?: AbortSignal;
}): Promise<FrenchAddressSuggestion[]> {
  const cityName = params.city.trim();
  if (!cityName) return [];

  const trimmed = params.query.trim();
  const cacheKey = `${cityName.toLowerCase()}|${params.postcode.trim()}`;

  if (trimmed.length < 3) {
    const cached = venueCache.get(cacheKey);
    if (cached) return cached;

    const venues = await searchNominatimViaProxy({
      city: cityName,
      mode: "seeds",
      signal: params.signal,
    });
    venueCache.set(cacheKey, venues);
    return venues;
  }

  return searchNominatimViaProxy({
    city: cityName,
    query: trimmed,
    signal: params.signal,
  });
}

/** Recherche des communes correspondant à [query] (min. 3 caractères). */
export async function searchFrenchCities(
  query: string,
  signal?: AbortSignal,
): Promise<FrenchAddressSuggestion[]> {
  return searchGeoPfAddresses({
    query,
    type: "municipality",
    signal,
    labelBuilder: (city, postalCode) => {
      if (!city) return "";
      if (!postalCode) return city;
      return `${city} (${postalCode})`;
    },
  });
}

/** Recherche lieux sportifs (OSM) puis rues (BAN) dans une commune. */
export async function searchFrenchStreets(params: {
  query: string;
  city: string;
  postalCode?: string;
  signal?: AbortSignal;
}): Promise<FrenchAddressSuggestion[]> {
  const cityName = params.city.trim();
  if (!cityName) return [];

  const trimmed = params.query.trim();
  const postcode = params.postalCode?.trim() ?? "";
  const venues = await searchSportsVenues({
    query: trimmed,
    city: cityName,
    postcode,
    signal: params.signal,
  });
  const streets =
    trimmed.length < 3
      ? []
      : await searchGeoPfAddresses({
          query: trimmed,
          postcode,
          city: cityName,
          signal: params.signal,
          labelBuilder: (_, __, street) => street,
        });

  return uniqueByLabel([...venues, ...streets], MAX_SUGGESTIONS);
}
