import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
} from "firebase/firestore";
import type { ClubRecord } from "@/lib/firebase/clubService";
import { getAppFirestore } from "@/lib/firebase/app";
import { Collections, Fields } from "@/lib/firebase/constants";
import { getClubMember } from "@/lib/firebase/memberService";
import { activeParentLinks, type ViroUserProfile } from "@/lib/firebase/types";
import type { StandingsClubSource } from "@/lib/standings/standingsGroups";
import {
  isVolleyballSport,
  parseFederationLink,
  parsePoolMatches,
  parsePoolStandings,
  type FederationTeam,
  type PoolData,
  type TeamFederationLink,
} from "@/lib/standings/standingsTypes";

/** Sous-collection et documents de la poule (`ProjectConfig` côté app). */
const FEDERATION_SUBCOLLECTION = "federation";
const STANDINGS_DOC = "standings";
const MATCHES_DOC = "matches";

/** Plafond de lecture des équipes d’un club (même valeur que le planning). */
const MAX_TEAMS_PER_CLUB = 80;

function teamsCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.teams,
  );
}

/** Équipe liée à une poule, ou `null` si le document n’a pas de lien. */
function parseFederationTeam(
  clubId: string,
  id: string,
  data: Record<string, unknown>,
): FederationTeam | null {
  const federation = parseFederationLink(data.federation);
  if (!federation) return null;
  const ids = (value: unknown) =>
    Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  return {
    id,
    clubId,
    name: String(data[Fields.name] ?? "Équipe").trim() || "Équipe",
    category:
      typeof data[Fields.category] === "string"
        ? String(data[Fields.category]).trim()
        : "",
    playerIds: ids(data[Fields.playerIds]),
    coachIds: ids(data[Fields.coachIds]),
    federation,
  };
}

/**
 * Équipes d’un club où le compte a une fiche (lecture de la liste) : équipes
 * liées à une poule, plus la catégorie de toutes les équipes (tons de
 * catégorie identiques à ceux de la page Équipes).
 */
async function loadClubFederationTeams(
  clubId: string,
): Promise<{ teams: FederationTeam[]; categories: string[] }> {
  const snap = await getDocs(query(teamsCol(clubId), limit(MAX_TEAMS_PER_CLUB)));
  const teams: FederationTeam[] = [];
  const categories: string[] = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    categories.push(
      typeof data[Fields.category] === "string"
        ? String(data[Fields.category]).trim()
        : "",
    );
    const team = parseFederationTeam(clubId, docSnap.id, data);
    if (team) teams.push(team);
  }
  return { teams, categories };
}

/** Équipes liées par id (parent : pas de `list` sur `teams`). */
async function loadFederationTeamsByIds(
  clubId: string,
  teamIds: string[],
): Promise<FederationTeam[]> {
  const unique = [...new Set(teamIds.filter(Boolean))];
  const teams = await Promise.all(
    unique.map(async (teamId) => {
      try {
        const snap = await getDoc(doc(teamsCol(clubId), teamId));
        if (!snap.exists()) return null;
        return parseFederationTeam(
          clubId,
          snap.id,
          snap.data() as Record<string, unknown>,
        );
      } catch {
        return null;
      }
    }),
  );
  return teams.filter((team): team is FederationTeam => team !== null);
}

/** Résultat du chargement des clubs de la page Classements. */
export type StandingsSources = {
  clubs: StandingsClubSource[];
  /** Clubs dont le chargement a échoué (affichage discret). */
  failedClubNames: string[];
};

/**
 * Charge, pour chaque club du compte (fiche membre ou lien parent actif) de
 * volley, les équipes liées à une poule qui le concernent et les prénoms des
 * enfants suivis : celles de sa fiche (`members/{uid}.teamIds`, joueur ou
 * coach) et celles des enfants, lues par id (pas de liste du club).
 */
export async function loadStandingsSources(params: {
  profile: ViroUserProfile;
  clubs: ClubRecord[];
}): Promise<StandingsSources> {
  const { profile } = params;
  const links = activeParentLinks(profile);
  const clubIds = new Set([
    ...profile.memberClubIds,
    ...links.map((link) => link.clubId),
  ]);
  const clubs = params.clubs.filter(
    (club, index, all) =>
      clubIds.has(club.id) &&
      isVolleyballSport(club.sport) &&
      all.findIndex((other) => other.id === club.id) === index,
  );

  const settled = await Promise.allSettled(
    clubs.map(async (club): Promise<StandingsClubSource> => {
      const isMember = profile.memberClubIds.includes(club.id);
      const childLinks = links.filter((link) => link.clubId === club.id);
      const children = await Promise.all(
        childLinks.map((link) =>
          getClubMember(club.id, link.memberId).catch(() => null),
        ),
      );
      const childNames: Record<string, string> = {};
      childLinks.forEach((link, index) => {
        const child = children[index];
        childNames[link.memberId] =
          child?.firstName.trim() || child?.displayName.trim() || "Enfant";
      });
      const own = isMember
        ? await getClubMember(club.id, profile.uid).catch(() => null)
        : null;
      const teams = await loadFederationTeamsByIds(club.id, [
        ...(own?.teamIds ?? []),
        ...children.flatMap((child) => child?.teamIds ?? []),
      ]);
      return {
        clubId: club.id,
        clubName: club.name.trim() || "Club",
        sport: club.sport,
        teams,
        categories: teams.map((team) => team.category),
        childNames,
      };
    }),
  );

  const sources: StandingsClubSource[] = [];
  const failedClubNames: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") sources.push(result.value);
    else failedClubNames.push(clubs[index]!.name.trim() || "Club");
  });
  return { clubs: sources, failedClubNames };
}

/**
 * Charge un seul club pour son onglet Classements (administrateur, donc
 * membre) : toutes ses équipes liées à une poule.
 */
export async function loadClubStandingsSource(
  club: ClubRecord,
): Promise<StandingsClubSource> {
  const { teams, categories } = await loadClubFederationTeams(club.id);
  return {
    clubId: club.id,
    clubName: club.name.trim() || "Club",
    sport: club.sport,
    teams,
    categories,
    childNames: {},
  };
}

/** Classement et matchs de la poule de l’équipe [teamId]. */
export async function loadPoolData(
  clubId: string,
  teamId: string,
): Promise<PoolData> {
  const federation = collection(
    doc(teamsCol(clubId), teamId),
    FEDERATION_SUBCOLLECTION,
  );
  const [standingsSnap, matchesSnap] = await Promise.all([
    getDoc(doc(federation, STANDINGS_DOC)),
    getDoc(doc(federation, MATCHES_DOC)),
  ]);
  return {
    standings: standingsSnap.exists()
      ? parsePoolStandings(standingsSnap.data())
      : null,
    matches: matchesSnap.exists() ? parsePoolMatches(matchesSnap.data()) : [],
  };
}

/** Lien FFVB de l’équipe [teamId], `null` si elle n’est liée à aucune poule. */
export async function loadTeamFederationLink(
  clubId: string,
  teamId: string,
): Promise<TeamFederationLink | null> {
  const snap = await getDoc(doc(teamsCol(clubId), teamId));
  if (!snap.exists()) return null;
  return parseFederationLink(
    (snap.data() as Record<string, unknown>).federation,
  );
}
