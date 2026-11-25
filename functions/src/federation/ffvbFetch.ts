import {
  FFVB_CSV_EXPORT_URL,
  ffvbCalendarUrl,
  ffvbCsvExportBody,
  ffvbPoolKey,
  type FfvbPoolRef,
} from "./ffvbUrl";
import {
  parseMatchesCsv,
  parsePoolLabel,
  parseStandingsHtml,
  type PoolData,
} from "./ffvbParser";

/** Délai et User-Agent de toutes les requêtes vers le site FFVB. */
export const FFVB_FETCH_TIMEOUT_MS = 15_000;
export const FFVB_USER_AGENT = "ViroTeam-sync";

/** Le site FFVB est injoignable ou a renvoyé une page inattendue. */
export class FfvbFetchError extends Error {}

async function fetchLatin1(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: { "User-Agent": FFVB_USER_AGENT, ...(init.headers ?? {}) },
    redirect: "error",
    signal: AbortSignal.timeout(FFVB_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new FfvbFetchError(`FFVB HTTP ${response.status}`);
  }
  // Le site FFVB est encodé en ISO-8859-1.
  return new TextDecoder("latin1").decode(await response.arrayBuffer());
}

/**
 * Lit classement (page HTML) et matchs (export CSV) d'une poule FFVB.
 * Lève [FfvbFetchError] si la poule est vide ou illisible.
 */
export async function fetchFfvbPool(ref: FfvbPoolRef): Promise<PoolData> {
  const [html, csv] = await Promise.all([
    fetchLatin1(ffvbCalendarUrl(ref)),
    fetchLatin1(FFVB_CSV_EXPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: ffvbCsvExportBody(ref).toString(),
    }),
  ]);
  const standings = parseStandingsHtml(html);
  const matches = parseMatchesCsv(csv);
  if (standings.length === 0 && matches.length === 0) {
    throw new FfvbFetchError(`Poule FFVB vide ou illisible (${ffvbPoolKey(ref)})`);
  }
  return { poolLabel: parsePoolLabel(html), standings, matches };
}

/** Cache des poules lues pendant une exécution (une seule requête par poule). */
export type PoolCache = Map<string, Promise<PoolData>>;

/** Lit une poule via [cache] (créé par l'appelant pour une exécution). */
export function fetchFfvbPoolCached(cache: PoolCache, ref: FfvbPoolRef): Promise<PoolData> {
  const key = ffvbPoolKey(ref);
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchFfvbPool(ref);
    cache.set(key, pending);
  }
  return pending;
}
