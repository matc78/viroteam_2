import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/adminApp";

const PLACES_AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";
const MAX_SUGGESTIONS = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 25;
const FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text",
  "suggestions.placePrediction.structuredFormat",
].join(",");
const requestCountsByIp = new Map<string, { count: number; windowStartMs: number }>();

type PlacePrediction = {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

type AutocompleteResponse = {
  suggestions?: Array<{ placePrediction?: PlacePrediction }>;
};

export type PlacesSuggestionDto = {
  label: string;
  city: string;
  postalCode: string;
  street: string;
};

function resolveClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.trim() ?? "";
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
}

function isRateLimited(clientIp: string, nowMs: number): boolean {
  const entry = requestCountsByIp.get(clientIp);
  if (!entry || nowMs - entry.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
    requestCountsByIp.set(clientIp, { count: 1, windowStartMs: nowMs });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  entry.count += 1;
  requestCountsByIp.set(clientIp, entry);
  return false;
}

async function authenticateRequest(request: NextRequest): Promise<boolean> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return false;
  }

  const idToken = authorization.slice("Bearer ".length).trim();
  if (!idToken) return false;

  try {
    const adminAuth = getAdminAuth();
    await adminAuth.verifyIdToken(idToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Proxy Places Autocomplete (New) pour le champ adresse (ville / CP restent BAN).
 * Query: `q` (min. 3), `city` requis, `postalCode` optionnel.
 */
export async function GET(request: NextRequest) {
  const isAuthenticated = await authenticateRequest(request);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const clientIp = resolveClientIp(request);
  const nowMs = Date.now();
  if (isRateLimited(clientIp, nowMs)) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans une minute." },
      { status: 429 },
    );
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY non configurée." },
      { status: 503 },
    );
  }

  const city = request.nextUrl.searchParams.get("city")?.trim() ?? "";
  const postalCode =
    request.nextUrl.searchParams.get("postalCode")?.trim() ?? "";
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!city) {
    return NextResponse.json({ error: "city requis" }, { status: 400 });
  }
  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] as PlacesSuggestionDto[] });
  }

  const inputParts = [query, postalCode, city].filter(Boolean);
  const body = {
    input: inputParts.join(" "),
    languageCode: "fr",
    includedRegionCodes: ["fr"],
    includeQueryPredictions: false,
  };

  try {
    const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: request.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Places HTTP ${response.status}: ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as AutocompleteResponse;
    const suggestions: PlacesSuggestionDto[] = [];
    const seen = new Set<string>();

    for (const item of payload.suggestions ?? []) {
      const prediction = item.placePrediction;
      if (!prediction) continue;

      const fullText = prediction.text?.text?.trim() ?? "";
      const mainText =
        prediction.structuredFormat?.mainText?.text?.trim() ?? "";
      const secondaryText =
        prediction.structuredFormat?.secondaryText?.text?.trim() ?? "";
      const street = mainText || fullText;
      if (!street) continue;

      const label = fullText || (secondaryText ? `${street} — ${secondaryText}` : street);
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      suggestions.push({
        label,
        city,
        postalCode,
        street,
      });
      if (suggestions.length >= MAX_SUGGESTIONS) break;
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    if (request.signal.aborted) {
      return new NextResponse(null, { status: 204 });
    }
    Sentry.captureException(error, {
      tags: { feature: "club_setup", area: "places_proxy" },
      extra: { city, postalCode, query },
    });
    return NextResponse.json(
      { error: "Recherche d'adresse indisponible." },
      { status: 502 },
    );
  }
}
