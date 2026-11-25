/**
 * Lecture des données FFVB d'une poule (fonctions pures, testées sur une
 * page réelle enregistrée dans `__fixtures__/`).
 *
 * - Classement : page HTML `vbspo_calendrier.php` (tableau « Points Jou. … »).
 * - Matchs : export CSV `vbspo_calendrier_export.php` (dates ISO, salle
 *   connue même après le match, numéros d'équipe).
 */

/** Une ligne du classement d'une poule. */
export type PoolStandingRow = {
  key: string;
  rank: number;
  name: string;
  points: number;
  played: number;
  won: number;
  lost: number;
  forfeits: number;
  wins30: number;
  wins31: number;
  wins32: number;
  losses23: number;
  losses13: number;
  losses03: number;
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
};

/** Score publié d'un match (du point de vue recevant / visiteur). */
export type PoolMatchScore = {
  home: number;
  away: number;
  sets: string[];
  /** Équipe déclarée forfait (`P` sur le site), le cas échéant. */
  forfeit?: "home" | "away";
};

/** Un match de la poule. */
export type PoolMatch = {
  code: string;
  round: number;
  /** `YYYY-MM-DD`, `null` si non encore programmé. */
  date: string | null;
  /** `HH:mm`, `null` si non encore programmé. */
  time: string | null;
  homeKey: string;
  homeName: string;
  awayKey: string;
  awayName: string;
  venue: string | null;
  score: PoolMatchScore | null;
};

/** Données lues pour une poule. */
export type PoolData = {
  poolLabel: string;
  standings: PoolStandingRow[];
  matches: PoolMatch[];
};

/**
 * Clé stable d'une équipe de la poule à partir de son nom
 * (`USM DE VIROFLAY` → `usm-de-viroflay`). Même clé pour le classement et
 * les matchs, utilisée dans les routes de l'app.
 */
export function poolTeamKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: "\"",
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  ocirc: "ô",
  icirc: "î",
  ucirc: "û",
  Eacute: "É",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

function cellText(rawCell: string): string {
  return decodeEntities(rawCell.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cellules texte de chaque ligne `<tr>` d'une page. On découpe sur les
 * ouvertures `<tr` (et non par paires `<tr>…</tr>`) pour rester correct
 * avec les tableaux imbriqués du site FFVB.
 */
function htmlRows(html: string): string[][] {
  return html
    .split(/<tr\b/i)
    .slice(1)
    .map((segment) => {
      const cells: string[] = [];
      const cellPattern = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
      let match: RegExpExecArray | null;
      while ((match = cellPattern.exec(segment)) !== null) {
        cells.push(cellText(match[1]));
      }
      return cells;
    });
}

function intOrZero(value: string | undefined): number {
  const parsed = parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Intitulé de la poule (bandeau titre de la page). */
export function parsePoolLabel(html: string): string {
  const match = /class=['"]?titreblanc['"]?[^>]*>([^<]+)</i.exec(html);
  return match ? cellText(match[1]) : "";
}

/** Classement de la poule (lignes « 1. ÉQUIPE 9 4 3 1 … »). */
export function parseStandingsHtml(html: string): PoolStandingRow[] {
  const rows: PoolStandingRow[] = [];
  for (const cells of htmlRows(html)) {
    if (cells.length < 19 || !/^\d+\.$/.test(cells[0])) continue;
    const name = cells[1];
    if (!name) continue;
    rows.push({
      key: poolTeamKey(name),
      rank: intOrZero(cells[0]),
      name,
      points: intOrZero(cells[2]),
      played: intOrZero(cells[3]),
      won: intOrZero(cells[4]),
      lost: intOrZero(cells[5]),
      forfeits: intOrZero(cells[6]),
      wins30: intOrZero(cells[7]),
      wins31: intOrZero(cells[8]),
      wins32: intOrZero(cells[9]),
      losses23: intOrZero(cells[10]),
      losses13: intOrZero(cells[11]),
      losses03: intOrZero(cells[12]),
      setsFor: intOrZero(cells[13]),
      setsAgainst: intOrZero(cells[14]),
      pointsFor: intOrZero(cells[16]),
      pointsAgainst: intOrZero(cells[17]),
    });
  }
  return rows;
}

/** Lit « 3/0 », « 3/P », « P/3 » : sets gagnés et forfait éventuel. */
function parseSetScore(raw: string): Pick<PoolMatchScore, "home" | "away" | "forfeit"> | null {
  const match = /^\s*([0-9P])\s*\/\s*([0-9P])\s*$/i.exec(raw);
  if (!match) return null;
  const home = match[1].toUpperCase();
  const away = match[2].toUpperCase();
  const result: Pick<PoolMatchScore, "home" | "away" | "forfeit"> = {
    home: home === "P" ? 0 : Number(home),
    away: away === "P" ? 0 : Number(away),
  };
  if (home === "P") result.forfeit = "home";
  if (away === "P") result.forfeit = "away";
  return result;
}

/** Matchs de la poule depuis l'export CSV (séparateur `;`, en-tête en 1re ligne). */
export function parseMatchesCsv(csv: string): PoolMatch[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(";").map((cell) => cell.trim());
  const column = (name: string) => header.indexOf(name);
  const indexes = {
    round: column("Jo"),
    code: column("Match"),
    date: column("Date"),
    time: column("Heure"),
    homeName: column("EQA_nom"),
    awayName: column("EQB_nom"),
    sets: column("Set"),
    score: column("Score"),
    venue: column("Salle"),
  };
  if (indexes.code < 0 || indexes.homeName < 0 || indexes.awayName < 0) {
    throw new Error("Export FFVB : colonnes inattendues");
  }

  const matches: PoolMatch[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(";").map((cell) => decodeEntities(cell).trim());
    const code = cells[indexes.code] ?? "";
    const homeName = cells[indexes.homeName] ?? "";
    const awayName = cells[indexes.awayName] ?? "";
    if (!code || !homeName || !awayName) continue;

    const date = cells[indexes.date] ?? "";
    const time = cells[indexes.time] ?? "";
    const venue = cells[indexes.venue] ?? "";
    const setScore = parseSetScore(cells[indexes.sets] ?? "");
    const setDetails = (cells[indexes.score] ?? "")
      .split(",")
      .map((set) => set.trim())
      .filter((set) => /^\d+-\d+$/.test(set));

    matches.push({
      code,
      round: intOrZero(cells[indexes.round]),
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      time: /^\d{2}:\d{2}$/.test(time) ? time : null,
      homeKey: poolTeamKey(homeName),
      homeName,
      awayKey: poolTeamKey(awayName),
      awayName,
      venue: venue || null,
      score: setScore ? { ...setScore, sets: setDetails } : null,
    });
  }
  return matches;
}
