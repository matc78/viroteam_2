import { sortTeamCategories } from "@/lib/teams/compareTeamCategories";
import {
  assignTeamCategoryTones,
  type TeamCategoryPaletteTone,
} from "@/lib/teams/teamCategoryTone";
import {
  poolKeyOf,
  type FederationTeam,
  type PoolStandings,
} from "@/lib/standings/standingsTypes";

/**
 * Regroupement des classements FFVB (page Classements). Miroir de
 * `lib/services/standings/standings_switcher.dart` pour la vue « Mes
 * équipes », plus l’onglet Classements d’un club (administrateurs).
 */

/** Club lu pour la page : équipes liées à une poule et enfants suivis. */
export type StandingsClubSource = {
  clubId: string;
  clubName: string;
  sport: string;
  /** Équipes du club liées à une poule (déjà filtrées sur `federation`). */
  teams: FederationTeam[];
  /**
   * Catégories de toutes les équipes lues (liées ou non) : fixent les tons
   * de catégorie, identiques à ceux de la page Équipes.
   */
  categories: string[];
  /** Enfants suivis : id de fiche → prénom. */
  childNames: Record<string, string>;
};

/** Une poule d’un club (plusieurs équipes du club peuvent la partager). */
export type StandingsEntry = {
  /** Clé stable `clubId|poolKey`. */
  key: string;
  clubId: string;
  clubName: string;
  /** Équipes du club dans la poule, triées par nom (au moins une). */
  teams: FederationTeam[];
  /** Prénoms des enfants suivis dans ces équipes. */
  childNames: string[];
};

/** Classements d’un club. */
export type StandingsClubGroup = {
  clubId: string;
  clubName: string;
  entries: StandingsEntry[];
};

/** Libellé des équipes sans catégorie (même texte que la page Équipes). */
const NO_CATEGORY_LABEL = "Sans catégorie";

const compareNames = (a: string, b: string) =>
  a.localeCompare(b, "fr", { sensitivity: "base" });

/** Libellé d’une entrée : noms des équipes du club. */
export function entryLabel(entry: StandingsEntry): string {
  return entry.teams.map((team) => team.name).join(" · ");
}

/** Clés fédérales des équipes du club dans la poule (lignes en avant). */
export function entryTeamKeys(entry: StandingsEntry): Set<string> {
  return new Set(entry.teams.map((team) => team.federation.teamKey));
}

/** Nom de la poule (libellé fédéral de la première équipe). */
export function entryPoolLabel(entry: StandingsEntry): string | null {
  return entry.teams[0]?.federation.poolLabel ?? null;
}

function groupByPool(
  source: StandingsClubSource,
  include: (team: FederationTeam) => string[] | null,
): StandingsEntry[] {
  const teamsByPool = new Map<string, FederationTeam[]>();
  const childrenByPool = new Map<string, Set<string>>();
  for (const team of source.teams) {
    const children = include(team);
    if (children === null) continue;
    const poolKey = poolKeyOf(team.federation);
    teamsByPool.set(poolKey, [...(teamsByPool.get(poolKey) ?? []), team]);
    const names = childrenByPool.get(poolKey) ?? new Set<string>();
    for (const name of children) names.add(name);
    childrenByPool.set(poolKey, names);
  }
  return [...teamsByPool.entries()].map(([poolKey, teams]) => ({
    key: `${source.clubId}|${poolKey}`,
    clubId: source.clubId,
    clubName: source.clubName,
    teams: [...teams].sort((a, b) => compareNames(a.name, b.name)),
    childNames: [...(childrenByPool.get(poolKey) ?? [])]
      .filter(Boolean)
      .sort(compareNames),
  }));
}

/**
 * Vue « Mes équipes » : par club, les poules des équipes où [uid] joue ou
 * coache, ou qu’un de ses enfants suit. Club actif d’abord, puis par nom ;
 * clubs sans classement suivi omis.
 */
export function buildMyStandingsGroups(params: {
  uid: string;
  clubs: StandingsClubSource[];
  activeClubId?: string | null;
}): StandingsClubGroup[] {
  const groups: StandingsClubGroup[] = [];
  for (const club of params.clubs) {
    const entries = groupByPool(club, (team) => {
      const roster = new Set([...team.playerIds, ...team.coachIds]);
      const children = Object.entries(club.childNames)
        .filter(([memberId]) => roster.has(memberId))
        .map(([, name]) => name);
      return roster.has(params.uid) || children.length > 0 ? children : null;
    }).sort((a, b) => compareNames(entryLabel(a), entryLabel(b)));
    if (entries.length > 0) {
      groups.push({ clubId: club.clubId, clubName: club.clubName, entries });
    }
  }
  return groups.sort((a, b) => {
    if (a.clubId === params.activeClubId) return -1;
    if (b.clubId === params.activeClubId) return 1;
    return compareNames(a.clubName, b.clubName);
  });
}

/** Poules d’une catégorie d’équipe (onglet Classements d’un club). */
export type StandingsCategoryGroup = {
  /** Libellé affiché (« Sans catégorie » si vide). */
  category: string;
  /** Ton de la catégorie (mêmes couleurs que la page Équipes). */
  tone: TeamCategoryPaletteTone;
  entries: StandingsEntry[];
};

/**
 * Onglet Classements d’un club : toutes les poules des équipes liées,
 * groupées par catégorie (celle de la première équipe de la poule), dans
 * l’ordre du catalogue du sport, « Sans catégorie » en dernier ; poules
 * triées par nom dans chaque groupe.
 */
export function buildClubStandingsCategories(
  club: StandingsClubSource,
): StandingsCategoryGroup[] {
  const order = sortTeamCategories(club.categories, club.sport);
  const tones = assignTeamCategoryTones(order);
  const byCategory = new Map<string, StandingsEntry[]>();
  for (const entry of groupByPool(club, () => [])) {
    const category = entry.teams[0]?.category.trim() ?? "";
    byCategory.set(category, [...(byCategory.get(category) ?? []), entry]);
  }
  const rank = (category: string) => {
    const index = category ? order.indexOf(category) : -1;
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...byCategory.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || compareNames(a, b))
    .map(([category, entries]) => ({
      category: category || NO_CATEGORY_LABEL,
      tone: tones.get(category) ?? "slate",
      entries: entries.sort((a, b) =>
        compareNames(entryLabel(a), entryLabel(b)),
      ),
    }));
}

/** Meilleur rang des équipes [teamKeys] dans [standings], `null` sinon. */
export function bestStandingRank(
  standings: PoolStandings | null,
  teamKeys: Set<string>,
): number | null {
  if (!standings) return null;
  let best: number | null = null;
  for (const row of standings.rows) {
    if (!teamKeys.has(row.key) || row.rank <= 0) continue;
    if (best === null || row.rank < best) best = row.rank;
  }
  return best;
}

/** Médaille d’un rang (podium + « chocolat »), `null` au-delà. */
export function rankMedal(
  rank: number,
): "gold" | "silver" | "bronze" | "chocolate" | null {
  switch (rank) {
    case 1:
      return "gold";
    case 2:
      return "silver";
    case 3:
      return "bronze";
    case 4:
      return "chocolate";
    default:
      return null;
  }
}
