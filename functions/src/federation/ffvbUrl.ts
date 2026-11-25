/**
 * Lien FFVB d'une poule : validation et URLs canoniques.
 *
 * On n'appelle jamais l'URL brute collée par l'utilisateur : on en extrait
 * saison / entité / poule puis on reconstruit les URLs du site FFVB.
 */

export const FFVB_PROVIDER = "ffvb";

const FFVB_HOSTS = new Set(["www.ffvbbeach.org", "ffvbbeach.org"]);
const FFVB_CALENDAR_PATH = "/ffvbapp/resu/vbspo_calendrier.php";
const FFVB_BASE = "https://www.ffvbbeach.org/ffvbapp/resu";

/** Poule FFVB identifiée par un lien. */
export type FfvbPoolRef = {
  season: string;
  codent: string;
  pool: string;
};

/**
 * Lit un lien de calendrier FFVB (`vbspo_calendrier.php?saison=…&codent=…&poule=…`).
 * Retourne `null` si le lien n'est pas une page de poule FFVB valide.
 */
export function parseFfvbUrl(raw: unknown): FfvbPoolRef | null {
  if (typeof raw !== "string") return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!FFVB_HOSTS.has(url.hostname.toLowerCase())) return null;
  if (url.pathname !== FFVB_CALENDAR_PATH) return null;

  const season = url.searchParams.get("saison")?.trim() ?? "";
  const codent = url.searchParams.get("codent")?.trim().toUpperCase() ?? "";
  const pool = url.searchParams.get("poule")?.trim().toUpperCase() ?? "";
  if (!/^\d{4}\/\d{4}$/.test(season)) return null;
  if (!/^[A-Z0-9]{2,12}$/.test(codent)) return null;
  if (!/^[A-Z0-9]{1,8}$/.test(pool)) return null;
  return { season, codent, pool };
}

/** URL publique canonique de la page calendrier + classement de la poule. */
export function ffvbCalendarUrl(ref: FfvbPoolRef): string {
  const params = new URLSearchParams({
    saison: ref.season,
    codent: ref.codent,
    poule: ref.pool,
  });
  return `${FFVB_BASE}/vbspo_calendrier.php?${params.toString()}`;
}

/** URL de l'export CSV du calendrier (POST, corps [ffvbCsvExportBody]). */
export const FFVB_CSV_EXPORT_URL = `${FFVB_BASE}/vbspo_calendrier_export.php`;

/** Fiche match PDF (POST, corps [ffvbMatchSheetBody]) — adresse complète de la salle. */
export const FFVB_MATCH_SHEET_URL =
  "https://www.ffvbbeach.org/ffvbapp/adressier/fiche_match_ffvb.php";

/** Corps du POST d'export CSV du calendrier complet de la poule. */
export function ffvbCsvExportBody(ref: FfvbPoolRef): URLSearchParams {
  return new URLSearchParams({
    cal_saison: ref.season,
    cal_codent: ref.codent,
    cal_codpoule: ref.pool,
    cal_coddiv: "",
    cal_codtour: "",
    typ_edition: "E",
    type: "RES",
    rech_equipe: "",
  });
}

/** Corps du POST de la fiche match (`saison` + `codent` + code match). */
export function ffvbMatchSheetBody(ref: FfvbPoolRef, matchCode: string): URLSearchParams {
  return new URLSearchParams({
    wss_saison: ref.season,
    codent: ref.codent,
    codmatch: matchCode,
  });
}

/** Clé stable d'une poule (cache par exécution, logs). */
export function ffvbPoolKey(ref: FfvbPoolRef): string {
  return `${ref.season}|${ref.codent}|${ref.pool}`;
}
