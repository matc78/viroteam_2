import { inflateSync } from "node:zlib";
import {
  FFVB_MATCH_SHEET_URL,
  ffvbMatchSheetBody,
  type FfvbPoolRef,
} from "./ffvbUrl";
import type { PoolMatch } from "./ffvbParser";
import { FFVB_FETCH_TIMEOUT_MS, FFVB_USER_AGENT } from "./ffvbFetch";

const ENRICH_CONCURRENCY = 4;

/** Adresse de salle extraite de la fiche match PDF. */
export type MatchVenueAddress = {
  name: string;
  street: string;
  city: string;
};

/** Vrai si [venue] contient déjà une rue / un code postal (chiffre). */
export function venueLooksComplete(venue: string | null | undefined): boolean {
  return typeof venue === "string" && /\d/.test(venue);
}

/**
 * Fusionne le nom court FFVB et l'adresse de la fiche :
 * `PERDREAU, 1 BIS RUE PERDREAU, 78390 BOIS D'ARCY`.
 */
export function formatVenueAddress(
  shortName: string | null,
  address: MatchVenueAddress,
): string {
  const parts = [
    shortName?.trim() || address.name,
    address.street,
    address.city,
  ]
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0);
  // Évite « PERDREAU, PERDREAU, … » si le nom est déjà la 1re ligne.
  const unique: string[] = [];
  for (const part of parts) {
    if (unique.some((kept) => kept.toUpperCase() === part.toUpperCase())) continue;
    unique.push(part);
  }
  return unique.join(", ");
}

/**
 * Salle à retenir : la fédé fait foi, sauf si l'ancienne valeur n'est que
 * l'adresse complète du même nom court (ou si la fédé ne publie plus rien).
 * Un vrai changement de salle remplace donc toujours l'ancienne adresse.
 */
export function preferVenue(
  fresh: string | null | undefined,
  previous: string | null | undefined,
): string | null {
  const a = fresh?.trim() || null;
  const b = previous?.trim() || null;
  if (!a) return b;
  return b && isVenueEnrichment(a, b) ? b : a;
}

/** Chaînes texte `(…)` Tj d'un flux PDF FPDF (échappements basiques). */
function pdfTjStrings(content: string): string[] {
  const out: string[] = [];
  const pattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const raw = match[0].slice(1, match[0].lastIndexOf(")"));
    out.push(
      raw
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\"),
    );
  }
  return out;
}

/** Décompresse les flux FlateDecode et concatène leur texte. */
function inflatePdfText(pdf: Buffer): string {
  const latin1 = pdf.toString("latin1");
  const chunks: string[] = [];
  let cursor = 0;
  while (true) {
    const streamAt = latin1.indexOf("stream", cursor);
    if (streamAt < 0) break;
    let dataStart = streamAt + "stream".length;
    if (latin1[dataStart] === "\r") dataStart += 1;
    if (latin1[dataStart] === "\n") dataStart += 1;
    const endAt = latin1.indexOf("endstream", dataStart);
    if (endAt < 0) break;
    const raw = pdf.subarray(dataStart, endAt);
    try {
      chunks.push(inflateSync(raw).toString("latin1"));
    } catch {
      // Flux non compressé ou corrompu : on ignore.
    }
    cursor = endAt + "endstream".length;
  }
  return chunks.join("\n");
}

/**
 * Lit le bloc « Salle » d'une fiche match FFVB (PDF FPDF) :
 * nom, rue, code postal + ville.
 */
export function parseMatchSheetVenue(pdf: Buffer): MatchVenueAddress | null {
  const strings = pdfTjStrings(inflatePdfText(pdf))
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
  const salleIndex = strings.findIndex((s) => /^salle$/i.test(s));
  if (salleIndex < 0) return null;
  const lines: string[] = [];
  for (let i = salleIndex + 1; i < strings.length; i++) {
    const line = strings[i];
    if (/^arbitre/i.test(line)) break;
    lines.push(line);
    if (lines.length >= 3) break;
  }
  if (lines.length < 2) return null;
  const name = lines[0];
  const street = lines[1] ?? "";
  const city = lines[2] ?? "";
  if (!street && !city) return null;
  return { name, street, city };
}

async function fetchMatchSheetPdf(
  ref: FfvbPoolRef,
  matchCode: string,
): Promise<Buffer> {
  const response = await fetch(FFVB_MATCH_SHEET_URL, {
    method: "POST",
    headers: {
      "User-Agent": FFVB_USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: ffvbMatchSheetBody(ref, matchCode).toString(),
    redirect: "error",
    signal: AbortSignal.timeout(FFVB_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Fiche match FFVB HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Complète `venue` avec l'adresse de la fiche match PDF quand le CSV
 * ne donne que le nom de salle. Les échecs individuels sont ignorés
 * (on garde le nom court). [previousByCode] évite de re-télécharger
 * une adresse déjà connue.
 */
export async function enrichMatchVenues(
  matches: PoolMatch[],
  ref: FfvbPoolRef,
  previousByCode: Map<string, string | null> = new Map(),
): Promise<PoolMatch[]> {
  // Fiche inutile si la salle retenue est déjà une adresse complète.
  const needsFetch = matches.filter(
    (match) =>
      match.code &&
      !venueLooksComplete(preferVenue(match.venue, previousByCode.get(match.code))),
  );

  const fetched = new Map<string, string>();
  await mapPool(needsFetch, ENRICH_CONCURRENCY, async (match) => {
    try {
      const pdf = await fetchMatchSheetPdf(ref, match.code);
      const address = parseMatchSheetVenue(pdf);
      if (!address) return;
      fetched.set(match.code, formatVenueAddress(match.venue, address));
    } catch (error) {
      console.warn("federation: fiche match illisible", {
        match: match.code,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return matches.map((match) => {
    const venue = preferVenue(
      fetched.get(match.code) ?? match.venue,
      previousByCode.get(match.code),
    );
    return venue === match.venue ? match : { ...match, venue };
  });
}

/**
 * Vrai si on ne fait qu'enrichir un nom de salle court en adresse complète
 * (pas de vrai déménagement → pas de notification push).
 */
export function isVenueEnrichment(
  previous: string | null,
  next: string | null,
): boolean {
  if (!previous || !next || previous === next) return false;
  const prev = previous.trim().toUpperCase();
  const nxt = next.trim().toUpperCase();
  return (
    nxt.includes(prev) && venueLooksComplete(nxt) && !venueLooksComplete(prev)
  );
}
