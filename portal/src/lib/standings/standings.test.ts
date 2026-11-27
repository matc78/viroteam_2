import { describe, expect, it } from "vitest";
import {
  buildPoolTeamSeason,
  displayPoolTeamName,
} from "./poolTeamSeason";
import {
  bestStandingRank,
  buildClubStandingsCategories,
  buildMyStandingsGroups,
  entryLabel,
  rankMedal,
  type StandingsClubSource,
} from "./standingsGroups";
import {
  isVolleyballSport,
  looksLikeFfvbPoolLink,
  parseFederationLink,
  parsePoolMatches,
  parsePoolStandings,
  poolKeyOf,
  type FederationTeam,
  type PoolMatch,
} from "./standingsTypes";

function team(
  id: string,
  overrides: Partial<FederationTeam> & { pool?: string; teamKey?: string } = {},
): FederationTeam {
  const { pool = "poule-a", teamKey = `key-${id}`, ...rest } = overrides;
  return {
    id,
    clubId: "club1",
    name: `Équipe ${id}`,
    category: "",
    playerIds: [],
    coachIds: [],
    federation: {
      provider: "ffvb",
      teamKey,
      teamName: teamKey,
      url: `https://ffvb/${pool}`,
      season: "2026",
      pool,
      poolLabel: `Poule ${pool}`,
      lastSyncAt: null,
      lastSyncFailed: false,
      excludedMemberIds: [],
    },
    ...rest,
  };
}

function club(
  overrides: Partial<StandingsClubSource> = {},
): StandingsClubSource {
  return {
    clubId: "club1",
    clubName: "VB Viroflay",
    sport: "Volleyball",
    teams: [],
    categories: [],
    childNames: {},
    ...overrides,
  };
}

function match(overrides: Partial<PoolMatch>): PoolMatch {
  return {
    code: "M1",
    round: 1,
    date: null,
    time: null,
    homeKey: "a",
    homeName: "A",
    awayKey: "b",
    awayName: "B",
    venue: null,
    score: null,
    ...overrides,
  };
}

describe("parsers", () => {
  it("lit un lien fédéral et ignore un lien incomplet", () => {
    expect(parseFederationLink({ provider: "ffvb" })).toBeNull();
    const link = parseFederationLink({
      provider: "ffvb",
      teamKey: "usm",
      lastSyncStatus: "error",
    });
    expect(link?.teamName).toBe("usm");
    expect(link?.lastSyncFailed).toBe(true);
    expect(poolKeyOf(link!)).toBe("ffvb||usm");
    expect(link?.excludedMemberIds).toEqual([]);
    expect(
      parseFederationLink({
        provider: "ffvb",
        teamKey: "usm",
        excludedMemberIds: ["m1", 3, "m2"],
      })?.excludedMemberIds,
    ).toEqual(["m1", "m2"]);
  });

  it("reconnaît un lien de page calendrier de poule FFVB", () => {
    expect(
      looksLikeFfvbPoolLink(
        "https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier.php?saison=2025/2026&codent=LIIDF&poule=1FB",
      ),
    ).toBe(true);
    expect(looksLikeFfvbPoolLink("https://www.ffvbbeach.org/ffvbapp/resu/")).toBe(false);
    expect(looksLikeFfvbPoolLink("https://example.com/vbspo_calendrier.php")).toBe(false);
    expect(looksLikeFfvbPoolLink("pas un lien")).toBe(false);
  });

  it("trie le classement par rang et écarte les lignes sans clé", () => {
    const standings = parsePoolStandings({
      teamKey: "usm",
      rows: [
        { key: "b", rank: 2, name: "B", points: 3 },
        { key: "", rank: 3 },
        { key: "a", rank: 1, name: "A", points: 6 },
      ],
    });
    expect(standings?.rows.map((row) => row.key)).toEqual(["a", "b"]);
    expect(standings?.myTeamKey).toBe("usm");
    expect(parsePoolStandings(undefined)).toBeNull();
  });

  it("lit les matchs et leur score", () => {
    const [first] = parsePoolMatches({
      matches: [
        {
          code: "X1",
          round: 2,
          date: "2026-11-28",
          homeKey: "a",
          awayKey: "b",
          score: { home: 3, away: 1, sets: ["25-18"], forfeit: "away" },
        },
        { round: 3 },
      ],
    });
    expect(first?.date).toBe("2026-11-28");
    expect(first?.score?.forfeitByAway).toBe(true);
    expect(parsePoolMatches(null)).toEqual([]);
  });

  it("reconnaît le volley, avec ou sans accent", () => {
    expect(isVolleyballSport("Volley-ball")).toBe(true);
    expect(isVolleyballSport("Beach volley")).toBe(true);
    expect(isVolleyballSport("Football")).toBe(false);
  });
});

describe("displayPoolTeamName", () => {
  it("garde les sigles et met en minuscules les petits mots", () => {
    expect(displayPoolTeamName("USM DE VIROFLAY")).toBe("USM de Viroflay");
    expect(displayPoolTeamName("MARLY-LE-ROI VOLLEY-BALL")).toBe(
      "Marly-le-Roi Volley-Ball",
    );
  });
});

describe("buildPoolTeamSeason", () => {
  it("calcule forme, bilans domicile / extérieur et parcours", () => {
    const matches = [
      match({ code: "1", date: "2026-10-01", homeKey: "a", awayKey: "b", venue: "Gymnase", score: { home: 3, away: 0, sets: ["25-10"], forfeitByHome: false, forfeitByAway: false } }),
      match({ code: "2", date: "2026-10-08", homeKey: "c", awayKey: "a", score: { home: 3, away: 1, sets: ["25-20"], forfeitByHome: false, forfeitByAway: false } }),
      match({ code: "3", date: "2026-12-01", homeKey: "a", awayKey: "c", venue: "Gymnase" }),
    ];
    const season = buildPoolTeamSeason({ standings: null, matches, teamKey: "a" });
    expect(season?.form).toEqual([true, false]);
    expect([season?.homeWon, season?.awayLost]).toEqual([1, 1]);
    expect(season?.homeVenues).toEqual(["Gymnase"]);
    expect(season?.played.map((m) => m.code)).toEqual(["2", "1"]);
    expect(season?.played[0]?.sets).toEqual(["20-25"]);
    expect(season?.upcoming.map((m) => m.code)).toEqual(["3"]);
  });

  it("null pour une équipe absente", () => {
    expect(buildPoolTeamSeason({ standings: null, matches: [], teamKey: "z" })).toBeNull();
  });
});

describe("buildMyStandingsGroups", () => {
  it("garde les poules où je joue ou qu’un enfant suit, fusionne une poule partagée", () => {
    const groups = buildMyStandingsGroups({
      uid: "me",
      activeClubId: "club2",
      clubs: [
        club({
          teams: [
            team("a", { playerIds: ["me"] }),
            team("b", { coachIds: ["kid"] }),
            team("c", { pool: "poule-b" }),
          ],
          childNames: { kid: "Léa" },
        }),
        club({
          clubId: "club2",
          clubName: "AS Zèbre",
          teams: [team("d", { pool: "poule-z", coachIds: ["me"] })],
        }),
      ],
    });
    expect(groups.map((group) => group.clubId)).toEqual(["club2", "club1"]);
    const viroflay = groups[1]!;
    expect(viroflay.entries).toHaveLength(1);
    expect(entryLabel(viroflay.entries[0]!)).toBe("Équipe a · Équipe b");
    expect(viroflay.entries[0]!.childNames).toEqual(["Léa"]);
  });
});

describe("buildClubStandingsCategories", () => {
  it("groupe les poules par catégorie, dans l’ordre du catalogue", () => {
    const groups = buildClubStandingsCategories(
      club({
        categories: ["Seniors", "M13", "", "M15"],
        teams: [
          team("senior-b", { name: "Seniors B", category: "Seniors", pool: "p1" }),
          team("senior-a", { name: "Seniors A", category: "Seniors", pool: "p3" }),
          team("m13", { category: "M13", pool: "p2" }),
          team("loisir", { category: "", pool: "p4" }),
        ],
      }),
    );
    expect(groups.map((group) => group.category)).toEqual([
      "M13",
      "Seniors",
      "Sans catégorie",
    ]);
    expect(groups[1]!.entries.map((entry) => entry.teams[0]!.id)).toEqual([
      "senior-a",
      "senior-b",
    ]);
    // Tons calculés sur toutes les catégories du club (M15 compris).
    expect(groups.map((group) => group.tone)).toEqual(["blue", "green", "slate"]);
  });
});

describe("rangs", () => {
  it("meilleur rang des équipes suivies et médailles", () => {
    const standings = parsePoolStandings({
      teamKey: "a",
      rows: [
        { key: "a", rank: 3 },
        { key: "b", rank: 1 },
        { key: "c", rank: 2 },
      ],
    });
    expect(bestStandingRank(standings, new Set(["a", "c"]))).toBe(2);
    expect(bestStandingRank(null, new Set(["a"]))).toBeNull();
    expect(rankMedal(1)).toBe("gold");
    expect(rankMedal(4)).toBe("chocolate");
    expect(rankMedal(5)).toBeNull();
  });
});
