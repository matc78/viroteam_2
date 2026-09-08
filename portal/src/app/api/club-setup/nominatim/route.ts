import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_HOST = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT =
  "ViroTeamClubSetup/1.0 (https://viroteam.app; club-setup portal)";
const MIN_INTERVAL_MS = 1100;
const MAX_LIMIT = 8;

const VENUE_SEED_QUERIES = [
  "stade",
  "gymnase",
  "piscine",
  "dojo",
  "omnisports",
] as const;

let lastRequestAt = 0;
let requestChain: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sérialise les appels Nominatim (~1 req/s) sur cette instance. */
async function throttledNominatimSearch(params: {
  query: string;
  city: string;
  signal?: AbortSignal;
}): Promise<unknown[]> {
  const run = async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    const cityName = params.city.trim();
    const q = cityName ? `${params.query.trim()} ${cityName}` : params.query.trim();
    const searchParams = new URLSearchParams({
      q,
      format: "json",
      addressdetails: "1",
      limit: String(MAX_LIMIT),
      countrycodes: "fr",
    });

    const response = await fetch(
      `${NOMINATIM_HOST}/search?${searchParams.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": NOMINATIM_USER_AGENT,
        },
        signal: params.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    const body = (await response.json()) as unknown;
    return Array.isArray(body) ? body : [];
  };

  const scheduled = requestChain.then(run, run);
  requestChain = scheduled.then(
    () => undefined,
    () => undefined,
  );
  return scheduled;
}

/**
 * Proxy Nominatim pour le wizard club-setup (UA serveur + rate-limit).
 * Query: `q` + `city`, ou `mode=seeds` + `city` pour les suggestions initiales.
 */
export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim() ?? "";
  const mode = request.nextUrl.searchParams.get("mode")?.trim() ?? "search";
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!city) {
    return NextResponse.json({ error: "city requis" }, { status: 400 });
  }

  try {
    if (mode === "seeds") {
      const batches: unknown[] = [];
      for (const seed of VENUE_SEED_QUERIES) {
        const results = await throttledNominatimSearch({
          query: seed,
          city,
          signal: request.signal,
        });
        batches.push(...results);
      }
      return NextResponse.json({ results: batches });
    }

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await throttledNominatimSearch({
      query,
      city,
      signal: request.signal,
    });
    return NextResponse.json({ results });
  } catch (error) {
    if (request.signal.aborted) {
      return new NextResponse(null, { status: 204 });
    }
    Sentry.captureException(error, {
      tags: { feature: "club_setup", area: "nominatim_proxy" },
      extra: { city, mode, query },
    });
    return NextResponse.json(
      { error: "Recherche lieux sportifs indisponible." },
      { status: 502 },
    );
  }
}
