import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]}'"]/gi;

/** Adresse FR simple : n° + voie, ou CP + ville. */
const ADDRESS_PATTERN =
  /\b\d{1,4}\s+(?:bis\s+|ter\s+)?(?:rue|av(?:enue)?|bd|boulevard|chemin|impasse|place|allée|allee|route|cours|quai)\s+[A-Za-zÀ-ÿ0-9'’.\-\s]{3,60}|\b\d{5}\s+[A-Za-zÀ-ÿ'’.\-]{2,}(?:\s+[A-Za-zÀ-ÿ'’.\-]{2,}){0,3}\b/gi;

type TextSegment =
  | { kind: "text"; value: string }
  | { kind: "url"; value: string; href: string }
  | { kind: "address"; value: string; href: string };

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

function collectMatches(
  text: string,
  pattern: RegExp,
  kind: "url" | "address",
): Array<{ start: number; end: number; kind: "url" | "address"; value: string }> {
  const out: Array<{
    start: number;
    end: number;
    kind: "url" | "address";
    value: string;
  }> = [];
  const re = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) != null) {
    out.push({
      start: match.index,
      end: match.index + match[0].length,
      kind,
      value: match[0],
    });
  }
  return out;
}

function overlaps(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Découpe le texte en segments texte / URL / adresse. */
export function segmentMessageText(text: string): TextSegment[] {
  if (!text) return [];
  const urlHits = collectMatches(text, URL_PATTERN, "url");
  const addressHits = collectMatches(text, ADDRESS_PATTERN, "address").filter(
    (hit) => !urlHits.some((url) => overlaps(hit, url)),
  );
  const hits = [...urlHits, ...addressHits].sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    if (hit.start > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, hit.start) });
    }
    if (hit.kind === "url") {
      segments.push({
        kind: "url",
        value: hit.value,
        href: normalizeUrl(hit.value),
      });
    } else {
      segments.push({
        kind: "address",
        value: hit.value,
        href: mapsHref(hit.value),
      });
    }
    cursor = hit.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", value: text.slice(cursor) });
  }
  return segments;
}

/** Extrait les URLs d’un texte (pour la galerie médias). */
export function extractUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  for (const segment of segmentMessageText(text)) {
    if (segment.kind === "url") urls.push(segment.href);
  }
  return urls;
}

/**
 * Rend un texte de message avec liens cliquables (URL + adresses Maps).
 */
export function linkifyMessageText(text: string): ReactNode {
  const segments = segmentMessageText(text);
  if (segments.length === 0) return text;
  if (segments.length === 1 && segments[0]!.kind === "text") {
    return segments[0]!.value;
  }
  return createElement(
    Fragment,
    null,
    ...segments.map((segment, index) => {
      if (segment.kind === "text") {
        return createElement(Fragment, { key: index }, segment.value);
      }
      return createElement(
        "a",
        {
          key: index,
          href: segment.href,
          target: "_blank",
          rel: "noopener noreferrer",
          className: "chatLink",
        },
        segment.value,
      );
    }),
  );
}
