import * as admin from "firebase-admin";
import type { DocumentReference } from "firebase-admin/firestore";
import { db } from "../db";
import { stringArray, uniq } from "../common";
import { SILENT_WRITE_FIELD } from "../notifications/silentWrite";
import { enrichMatchVenues, isVenueEnrichment } from "./ffvbMatchSheet";
import { fetchFfvbPoolCached, type PoolCache } from "./ffvbFetch";
import type { PoolMatch } from "./ffvbParser";
import { FFVB_PROVIDER, type FfvbPoolRef } from "./ffvbUrl";
import {
  importConvocation,
  isImportedFederationEvent,
  mergePoolMatches,
  planTeamSync,
  type ExistingFederationEvent,
  type FederationEventFields,
  type FederationEventPatch,
  type TeamMatchScore,
} from "./federationSyncUtils";

/** Sous-collection `teams/{teamId}/federation` (docs `standings` et `matches`). */
export const FEDERATION_SUBCOLLECTION = "federation";
export const STANDINGS_DOC = "standings";
export const MATCHES_DOC = "matches";

const BATCH_LIMIT = 400;

/** Lien fédé stocké sur `teams/{teamId}.federation`. */
export type TeamFederationLink = FfvbPoolRef & {
  provider: typeof FFVB_PROVIDER;
  teamKey: string;
  teamName: string;
  linkedBy: string | null;
  /** Joueurs non convoqués par défaut sur les matchs créés par la synchro. */
  excludedMemberIds: string[];
};

/** Bilan d'une synchro d'équipe. */
export type TeamSyncReport = {
  created: number;
  updated: number;
  unchanged: number;
  missing: number;
};

/** Lit le lien fédé d'une équipe, `null` si absent ou incomplet. */
export function readFederationLink(team: Record<string, unknown>): TeamFederationLink | null {
  const raw = team.federation as Record<string, unknown> | undefined;
  if (!raw || raw.provider !== FFVB_PROVIDER) return null;
  const season = typeof raw.season === "string" ? raw.season : "";
  const codent = typeof raw.codent === "string" ? raw.codent : "";
  const pool = typeof raw.pool === "string" ? raw.pool : "";
  const teamKey = typeof raw.teamKey === "string" ? raw.teamKey : "";
  if (!season || !codent || !pool || !teamKey) return null;
  return {
    provider: FFVB_PROVIDER,
    season,
    codent,
    pool,
    teamKey,
    teamName: typeof raw.teamName === "string" ? raw.teamName : "",
    linkedBy: typeof raw.linkedBy === "string" ? raw.linkedBy : null,
    excludedMemberIds: stringArray(raw.excludedMemberIds),
  };
}

function utcMidnight(dateIso: string): admin.firestore.Timestamp {
  const [year, month, day] = dateIso.split("-").map(Number);
  return admin.firestore.Timestamp.fromDate(new Date(Date.UTC(year, month - 1, day)));
}

function readScore(raw: unknown): TeamMatchScore | null {
  if (!raw || typeof raw !== "object") return null;
  const score = raw as Record<string, unknown>;
  if (typeof score.us !== "number" || typeof score.them !== "number") return null;
  const result: TeamMatchScore = {
    us: score.us,
    them: score.them,
    sets: stringArray(score.sets),
  };
  if (score.forfeit === "us" || score.forfeit === "them") result.forfeit = score.forfeit;
  return result;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Champs Firestore d'un patch fédé (date reconvertie en minuit UTC). */
function patchToFirestore(patch: FederationEventPatch): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (patch.dateIso) data.date = utcMidnight(patch.dateIso);
  if (patch.dateId) data.dateId = patch.dateId;
  if (patch.startTime) data.startTime = patch.startTime;
  if (patch.matchVenue) data.matchVenue = patch.matchVenue;
  if (patch.location) data.location = patch.location;
  if (patch.opponentName) data.opponentName = patch.opponentName;
  if (patch.score) data.score = patch.score;
  return data;
}

function newEventData(params: {
  fields: FederationEventFields;
  matchCode: string;
  teamId: string;
  teamName: string;
  teamMemberIds: string[];
  excludedMemberIds: string[];
  creatorId: string | null;
}): Record<string, unknown> {
  const { fields } = params;
  const data: Record<string, unknown> = {
    type: "match",
    title: params.teamName,
    location: fields.location ?? "",
    teamIds: [params.teamId],
    allTeams: false,
    date: utcMidnight(fields.dateIso),
    dateId: fields.dateId,
    matchVenue: fields.matchVenue,
    teamMemberIds: params.teamMemberIds,
    rsvp: {},
    creatorId: params.creatorId,
    canceled: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: FFVB_PROVIDER,
    externalMatchId: params.matchCode,
    opponentName: fields.opponentName,
  };
  if (params.excludedMemberIds.length > 0) {
    data.excludedMemberIds = params.excludedMemberIds;
  }
  if (fields.startTime) data.startTime = fields.startTime;
  if (fields.score) data.score = fields.score;
  return data;
}

async function commitInBatches(
  writes: { ref: DocumentReference; data: Record<string, unknown>; create: boolean }[],
): Promise<void> {
  const firestore = db();
  for (let start = 0; start < writes.length; start += BATCH_LIMIT) {
    const batch = firestore.batch();
    for (const write of writes.slice(start, start + BATCH_LIMIT)) {
      if (write.create) batch.set(write.ref, write.data);
      else batch.update(write.ref, write.data);
    }
    await batch.commit();
  }
}

/**
 * Synchronise une équipe liée à une poule FFVB : matchs → événements
 * (`ffvb_{teamId}_{code}`), classement et matchs de la poule →
 * `teams/{teamId}/federation/*`, puis `federation.lastSync*`.
 *
 * `silent` (première liaison) pose `silentWriteAt` : aucune notification.
 * Sinon, le trigger d'événement existant notifie les reports et les
 * changements de salle / domicile-extérieur. Tout match créé (liaison ou
 * synchro suivante) reprend les convoqués par défaut du lien
 * (`federation.excludedMemberIds`) ; un match existant garde ses
 * convocations. En cas d'échec, l'équipe passe en `lastSyncStatus: "error"`
 * et l'erreur est relancée.
 */
export async function syncTeamFederation(params: {
  clubId: string;
  teamId: string;
  silent: boolean;
  cache: PoolCache;
}): Promise<TeamSyncReport> {
  const firestore = db();
  const clubRef = firestore.collection("clubs").doc(params.clubId);
  const teamRef = clubRef.collection("teams").doc(params.teamId);
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  const teamSnap = await teamRef.get();
  const team = teamSnap.data() ?? {};
  const link = readFederationLink(team);
  if (!link) throw new Error("Équipe sans lien fédération");

  try {
    const pool = await fetchFfvbPoolCached(params.cache, link);
    const teamInPool =
      pool.standings.some((row) => row.key === link.teamKey) ||
      pool.matches.some((m) => m.homeKey === link.teamKey || m.awayKey === link.teamKey);
    if (!teamInPool) throw new Error(`Équipe « ${link.teamName} » absente de la poule`);

    const federationRef = teamRef.collection(FEDERATION_SUBCOLLECTION);
    const previousMatchesSnap = await federationRef.doc(MATCHES_DOC).get();
    const previousMatches = (previousMatchesSnap.data()?.matches ?? []) as PoolMatch[];
    const previousVenues = new Map(
      previousMatches.map((match) => [match.code, match.venue ?? null]),
    );
    // Adresse complète via fiche match PDF (le CSV ne donne que le nom de salle).
    const matches = await enrichMatchVenues(pool.matches, link, previousVenues);

    const eventsSnap = await clubRef
      .collection("events")
      .where("teamIds", "array-contains", params.teamId)
      .get();
    const existing = new Map<string, ExistingFederationEvent>();
    for (const doc of eventsSnap.docs) {
      const data = doc.data();
      if (data.source !== FFVB_PROVIDER) continue;
      existing.set(doc.id, {
        dateId: stringOrNull(data.dateId),
        startTime: stringOrNull(data.startTime),
        matchVenue: stringOrNull(data.matchVenue),
        location: stringOrNull(data.location),
        opponentName: stringOrNull(data.opponentName),
        score: readScore(data.score),
        canceled: data.canceled === true,
      });
    }

    const plan = planTeamSync({
      teamId: params.teamId,
      teamKey: link.teamKey,
      matches,
      existing,
      // Liaison (silencieuse) = import complet, même après une ancienne liaison.
      previousMatches: params.silent ? [] : previousMatches,
    });
    const teamName = typeof team.name === "string" ? team.name : link.teamName;
    const convocation = importConvocation({
      playerIds: uniq(stringArray(team.playerIds)),
      coachIds: uniq(stringArray(team.coachIds)),
      excludedPlayerIds: link.excludedMemberIds,
    });
    const silentStamp = { [SILENT_WRITE_FIELD]: timestamp };
    const eventsRef = clubRef.collection("events");

    await commitInBatches([
      ...plan.creates.map((create) => ({
        ref: eventsRef.doc(create.eventId),
        data: {
          ...newEventData({
            fields: create.fields,
            matchCode: create.matchCode,
            teamId: params.teamId,
            teamName,
            teamMemberIds: convocation.teamMemberIds,
            excludedMemberIds: convocation.excludedMemberIds,
            creatorId: link.linkedBy,
          }),
          ...(params.silent ? silentStamp : {}),
        },
        create: true,
      })),
      ...plan.updates.map((update) => {
        const current = existing.get(update.eventId);
        const patchKeys = Object.keys(update.patch);
        const enrichmentOnly =
          patchKeys.length === 1 &&
          update.patch.location != null &&
          isVenueEnrichment(current?.location ?? null, update.patch.location);
        return {
          ref: eventsRef.doc(update.eventId),
          data: {
            ...patchToFirestore(update.patch),
            ...(params.silent || enrichmentOnly ? silentStamp : {}),
          },
          create: false,
        };
      }),
    ]);

    await Promise.all([
      federationRef.doc(STANDINGS_DOC).set({
        provider: FFVB_PROVIDER,
        poolLabel: pool.poolLabel,
        teamKey: link.teamKey,
        rows: pool.standings,
        fetchedAt: timestamp,
      }),
      federationRef.doc(MATCHES_DOC).set({
        provider: FFVB_PROVIDER,
        teamKey: link.teamKey,
        matches: mergePoolMatches(matches, previousMatches),
        fetchedAt: timestamp,
      }),
    ]);
    await teamRef.update({
      "federation.poolLabel": pool.poolLabel,
      "federation.lastSyncAt": timestamp,
      "federation.lastSyncStatus": "ok",
      "federation.lastSyncError": admin.firestore.FieldValue.delete(),
    });

    if (plan.missing.length > 0) {
      console.warn("syncTeamFederation: matchs disparus de la poule", {
        clubId: params.clubId,
        teamId: params.teamId,
        missing: plan.missing,
      });
    }
    return {
      created: plan.creates.length,
      updated: plan.updates.length,
      unchanged: plan.unchanged,
      missing: plan.missing.length,
    };
  } catch (error) {
    console.error("syncTeamFederation: échec", {
      clubId: params.clubId,
      teamId: params.teamId,
      error,
    });
    await teamRef
      .update({
        "federation.lastSyncAt": timestamp,
        "federation.lastSyncStatus": "error",
        "federation.lastSyncError": error instanceof Error ? error.message : String(error),
      })
      .catch(() => undefined);
    throw error;
  }
}

/**
 * Supprime les événements importés par la synchro fédérale d'une équipe
 * (lien erroné, poule abandonnée). Les matchs saisis à la main sont gardés ;
 * une suppression ne notifie personne. Retourne le nombre d'événements supprimés.
 */
export async function deleteImportedFederationEvents(params: {
  clubId: string;
  teamId: string;
}): Promise<number> {
  const firestore = db();
  const eventsSnap = await firestore
    .collection("clubs")
    .doc(params.clubId)
    .collection("events")
    .where("teamIds", "array-contains", params.teamId)
    .get();
  // Filtre en mémoire : même requête que la synchro, sans index composite.
  const refs = eventsSnap.docs
    .filter((doc) => isImportedFederationEvent(doc.id, doc.get("source"), params.teamId))
    .map((doc) => doc.ref);
  for (let start = 0; start < refs.length; start += BATCH_LIMIT) {
    const batch = firestore.batch();
    for (const ref of refs.slice(start, start + BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }
  return refs.length;
}
