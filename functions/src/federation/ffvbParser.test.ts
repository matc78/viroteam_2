import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseMatchesCsv,
  parsePoolLabel,
  parseStandingsHtml,
  poolTeamKey,
} from "./ffvbParser";
import { ffvbCalendarUrl, parseFfvbUrl } from "./ffvbUrl";

// Fixtures réelles (poule 1MB, saison 2026/2027), encodées en Latin-1 comme le site.
const fixturesDir = join(__dirname, "..", "..", "src", "federation", "__fixtures__");
const html = readFileSync(join(fixturesDir, "ffvb_1MB.html"), "latin1");
const csv = readFileSync(join(fixturesDir, "ffvb_1MB.csv"), "latin1");

test("parseFfvbUrl accepte un lien de poule et refuse le reste", () => {
  const ref = parseFfvbUrl(
    "https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier.php?saison=2026/2027&codent=PTIDF78&poule=1MB",
  );
  assert.deepEqual(ref, { season: "2026/2027", codent: "PTIDF78", pool: "1MB" });
  assert.equal(
    ffvbCalendarUrl(ref!),
    "https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier.php?saison=2026%2F2027&codent=PTIDF78&poule=1MB",
  );
  assert.equal(parseFfvbUrl("https://evil.example/ffvbapp/resu/vbspo_calendrier.php?saison=2026/2027&codent=A&poule=1"), null);
  assert.equal(parseFfvbUrl("https://www.ffvbbeach.org/autre.php?saison=2026/2027&codent=PTIDF78&poule=1MB"), null);
  assert.equal(parseFfvbUrl("https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier.php?saison=x&codent=PTIDF78&poule=1MB"), null);
  assert.equal(parseFfvbUrl("pas un lien"), null);
});

test("poolTeamKey donne une clé stable sans accents", () => {
  assert.equal(poolTeamKey("USM DE VIROFLAY"), "usm-de-viroflay");
  assert.equal(poolTeamKey("VOLLEY-BALL BOIS D'ARCY 2"), "volley-ball-bois-d-arcy-2");
  assert.equal(poolTeamKey("Équipe  Été"), "equipe-ete");
});

test("parsePoolLabel lit l'intitulé de la poule", () => {
  assert.equal(parsePoolLabel(html), "1MB - ACCESSION REGIONALE MASC - 78 - POULE SUD");
});

test("parseStandingsHtml lit les 8 équipes du classement", () => {
  const rows = parseStandingsHtml(html);
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[0], {
    key: "volley-club-plaisir-villepreux-2",
    rank: 1,
    name: "VOLLEY-CLUB PLAISIR-VILLEPREUX 2",
    points: 9,
    played: 4,
    won: 3,
    lost: 1,
    forfeits: 0,
    wins30: 1,
    wins31: 2,
    wins32: 0,
    losses23: 0,
    losses13: 0,
    losses03: 1,
    setsFor: 9,
    setsAgainst: 5,
    pointsFor: 313,
    pointsAgainst: 288,
  });
  const viroflay = rows.find((row) => row.name === "USM DE VIROFLAY");
  assert.equal(viroflay?.rank, 3);
  assert.equal(viroflay?.wins32, 2);
  const montigny = rows[7];
  assert.equal(montigny.points, -1);
  assert.equal(montigny.losses03, 4);
});

test("parseMatchesCsv lit les 56 matchs, scores, forfaits et salles", () => {
  const matches = parseMatchesCsv(csv);
  assert.equal(matches.length, 56);

  const first = matches[0];
  assert.equal(first.code, "1MBA001");
  assert.equal(first.round, 1);
  assert.equal(first.date, "2026-10-04");
  assert.equal(first.time, "15:00");
  assert.equal(first.homeName, "VALLEE DE CHEVREUSE VOLLEY-BALL");
  assert.equal(first.awayKey, "marly-le-roi-volley-ball");
  assert.equal(first.venue, "GYMNASE DES TROIS RIVIERES");
  assert.deepEqual(first.score, { home: 0, away: 3, sets: ["18-25", "22-25", "18-25"] });

  const forfeit = matches.find((match) => match.code === "1MBA002");
  assert.deepEqual(forfeit?.score, {
    home: 3,
    away: 0,
    forfeit: "away",
    sets: ["25-0", "25-0", "25-0"],
  });

  const upcoming = matches.find((match) => match.code === "1MBR054");
  assert.equal(upcoming?.score, null);
  assert.equal(upcoming?.venue, "GAILLON");
  assert.equal(upcoming?.date, "2027-03-21");
});
