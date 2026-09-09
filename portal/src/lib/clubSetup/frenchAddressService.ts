import * as Sentry from "@sentry/nextjs";
import { getFirebaseAuth } from "@/lib/firebase/app";

/** Suggestion d’adresse française (GeoPF BAN pour villes, Places pour adresses). */
export type FrenchAddressSuggestion = {
  label: string;
  city: string;
  postalCode: string;
  street: string;
};

const GEOPF_HOST = "https://data.geopf.fr";
const GEOPF_SEARCH_PATH = "/geocodage/search";
const MAX_SUGGESTIONS = 8;

function firstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return "";
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
      });
    }

    return uniqueByLabel(suggestions);
  } catch (error) {
    if (params.signal?.aborted) return [];
    reportAddressIssue("geopf_fetch", error);
    return [];
  }
}

async function searchPlacesViaProxy(params: {
  query: string;
  city: string;
  postalCode?: string;
  signal?: AbortSignal;
}): Promise<FrenchAddressSuggestion[]> {
  const cityName = params.city.trim();
  const trimmed = params.query.trim();
  if (!cityName || trimmed.length < 3) return [];

  const searchParams = new URLSearchParams({
    q: trimmed,
    city: cityName,
  });
  const postal = params.postalCode?.trim() ?? "";
  if (postal) searchParams.set("postalCode", postal);

  try {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      reportAddressIssue("places_proxy_missing_auth_user", new Error("Missing auth user"));
      return [];
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch(
      `/api/club-setup/places?${searchParams.toString()}`,
      {
        signal: params.signal,
        headers: { Authorization: `Bearer ${idToken}` },
      },
    );
    if (!response.ok) {
      reportAddressIssue(
        `places_proxy_http_${response.status}`,
        new Error(response.statusText),
      );
      return [];
    }
    const body = (await response.json()) as {
      suggestions?: FrenchAddressSuggestion[];
    };
    return uniqueByLabel(body.suggestions ?? []);
  } catch (error) {
    if (params.signal?.aborted) return [];
    reportAddressIssue("places_proxy_fetch", error);
    return [];
  }
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

/** Recherche d’adresses via Google Places dans une commune. */
export async function searchFrenchStreets(params: {
  query: string;
  city: string;
  postalCode?: string;
  signal?: AbortSignal;
}): Promise<FrenchAddressSuggestion[]> {
  const cityName = params.city.trim();
  if (!cityName) return [];

  return searchPlacesViaProxy({
    query: params.query,
    city: cityName,
    postalCode: params.postalCode,
    signal: params.signal,
  });
}
