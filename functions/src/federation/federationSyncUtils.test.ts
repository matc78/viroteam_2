import test from "node:test";
import assert from "node:assert/strict";
import type { PoolMatch } from "./ffvbParser";
import {
  federationEventId,
  isImportedFederationEvent,
  mergePoolMatches,
  planTeamSync,
  poolTeams,
  toEventFields,
  type ExistingFederationEvent,
} from "./federationSyncUtils";

const VIROFLAY = "usm-de-viroflay";

function match(overrides: Partial<PoolMatch> = {}): PoolMatch {
  return {
    code: "1MBA005",
    round: 2,
    date: "2026-10-11",
    time: "15:00",
    homeKey: VIROFLAY,
    homeName: "USM DE VIROFLAY",
    awayKey: "marly-le-roi-volley-ball",
    awayName: "MARLY-LE-ROI VOLLEY-BALL",
    venue: "GAILLON",
    score: null,
    ...overrides,
  };
}

function existingFrom(m: PoolMatch, overrides: Partial<ExistingFederationEvent> = {}): ExistingFederationEvent {
  const fields = toEventFields(m, VIROFLAY)!;
  return {
    dateId: fields.dateId,
    startTime: fields.startTime,
    matchVenue: fields.matchVenue,
    location: fields.location,
    opponentName: fields.opponentName,
    score: fields.score,
    canceled: false,
    ...overrides,
  };
}

test("toEventFields : domicile, extérieur, score du point de vue du club", () => {
  const home = toEventFields(
    match({ score: { home: 3, away: 2, sets: ["22-25", "27-25"] } }),
    VIROFLAY,
  );
  assert.equal(home?.matchVenue, "home");
  assert.equal(home?.opponentName, "MARLY-LE-ROI VOLLEY-BALL");
  assert.equal(home?.dateId, "20261011");
  assert.deepEqual(home?.score, { us: 3, them: 2, sets: ["22-25", "27-25"] });

  const away = toEventFields(
    match({
      homeKey: "marly-le-roi-volley-ball",
      homeName: "MARLY-LE-ROI VOLLEY-BALL",
      awayKey: VIROFLAY,
      awayName: "USM DE VIROFLAY",
      score: { home: 3, away: 0, sets: ["25-13"], forfeit: "away" },
    }),
    VIROFLAY,
  );
  assert.equal(away?.matchVenue, "away");
  assert.deepEqual(away?.score, { us: 0, them: 3, sets: ["13-25"], forfeit: "us" });

  assert.equal(toEventFields(match({ homeKey: "autre", awayKey: "autre-2" }), VIROFLAY), null);
  assert.equal(toEventFields(match({ date: null }), VIROFLAY), null);
});

test("planTeamSync crée les nouveaux matchs avec un id déterministe", () => {
  const plan = planTeamSync({ teamId: "t1", teamKey: VIROFLAY, matches: [match()], existing: new Map() });
  assert.equal(plan.creates.length, 1);
  assert.equal(plan.creates[0].eventId, "ffvb_t1_1MBA005");
  assert.equal(federationEventId("t1", "1MB/A 5"), "ffvb_t1_1MBA5");
});

test("planTeamSync : rien à faire, report, salle, score", () => {
  const base = match();
  const id = federationEventId("t1", base.code);

  const same = planTeamSync({
    teamId: "t1", teamKey: VIROFLAY, matches: [base], existing: new Map([[id, existingFrom(base)]]),
  });
  assert.equal(same.unchanged, 1);
  assert.equal(same.updates.length, 0);

  const moved = planTeamSync({
    teamId: "t1",
    teamKey: VIROFLAY,
    matches: [match({ date: "2026-10-12", time: "18:00", venue: "AUTRE GYMNASE" })],
    existing: new Map([[id, existingFrom(base)]]),
  });
  assert.deepEqual(moved.updates[0].patch, {
    dateIso: "2026-10-12",
    dateId: "20261012",
    startTime: "18:00",
    location: "AUTRE GYMNASE",
  });

  const scored = planTeamSync({
    teamId: "t1",
    teamKey: VIROFLAY,
    matches: [match({ venue: null, score: { home: 3, away: 1, sets: ["25-20"] } })],
    existing: new Map([[id, existingFrom(base)]]),
  });
  assert.deepEqual(scored.updates[0].patch, { score: { us: 3, them: 1, sets: ["25-20"] } });
});

test("planTeamSync ignore les événements annulés et signale les disparus", () => {
  const base = match();
  const id = federationEventId("t1", base.code);
  const plan = planTeamSync({
    teamId: "t1",
    teamKey: VIROFLAY,
    matches: [match({ date: "2026-12-01" })],
    existing: new Map([
      [id, existingFrom(base, { canceled: true })],
      ["ffvb_t1_OLD", existingFrom(base)],
    ]),
  });
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.missing, ["ffvb_t1_OLD"]);
});

test("planTeamSync ne recrée pas un match importé puis supprimé par le coach", () => {
  const base = match();
  const plan = planTeamSync({
    teamId: "t1",
    teamKey: VIROFLAY,
    matches: [base, match({ code: "1MBA009" })],
    existing: new Map(),
    previousMatches: [base, match({ code: "1MBA009", date: null })],
  });
  // 1MBA005 déjà importé (supprimé depuis) ; 1MBA009 vient d'être programmé.
  assert.deepEqual(plan.creates.map((create) => create.matchCode), ["1MBA009"]);
});

test("mergePoolMatches garde la salle connue", () => {
  const merged = mergePoolMatches([match({ venue: null })], [match({ venue: "GAILLON" })]);
  assert.equal(merged[0].venue, "GAILLON");
});

test("mergePoolMatches préfère l'adresse complète au nom court", () => {
  const full = "PERDREAU, 1 BIS RUE PERDREAU, 78390 BOIS D'ARCY";
  const merged = mergePoolMatches(
    [match({ venue: "PERDREAU" })],
    [match({ venue: full })],
  );
  assert.equal(merged[0].venue, full);
});

test("poolTeams suit le classement, sinon les matchs", () => {
  assert.deepEqual(poolTeams([], [match()]), [
    { key: "marly-le-roi-volley-ball", name: "MARLY-LE-ROI VOLLEY-BALL" },
    { key: VIROFLAY, name: "USM DE VIROFLAY" },
  ]);
});

test("isImportedFederationEvent : seulement les matchs FFVB importés de l'équipe", () => {
  const id = federationEventId("team1", "1MBA001");
  assert.equal(isImportedFederationEvent(id, "ffvb", "team1"), true);
  assert.equal(isImportedFederationEvent(id, undefined, "team1"), false);
  assert.equal(isImportedFederationEvent(id, "ffvb", "team2"), false);
  assert.equal(isImportedFederationEvent("manualEvent", "ffvb", "team1"), false);
});
