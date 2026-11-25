import * as admin from "firebase-admin";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { requireString, requireUid } from "../common";
import { db, defineDualCallable } from "../db";
import { assertPermissionOrTeamCoach } from "../permissions";
import { FfvbFetchError, fetchFfvbPoolCached, type PoolCache } from "./ffvbFetch";
import type { PoolData } from "./ffvbParser";
import { FFVB_PROVIDER, ffvbCalendarUrl, parseFfvbUrl, type FfvbPoolRef } from "./ffvbUrl";
import {
  FEDERATION_SUBCOLLECTION,
  MATCHES_DOC,
  STANDINGS_DOC,
  deleteImportedFederationEvents,
  readFederationLink,
  syncTeamFederation,
  type TeamSyncReport,
} from "./federationSync";
import { poolTeams } from "./federationSyncUtils";

/** Délai minimal entre deux actualisations manuelles d'une équipe. */
const MANUAL_REFRESH_COOLDOWN_MS = 10 * 60 * 1000;

const INVALID_LINK_MESSAGE =
  "Ce lien n'est pas une page de poule FFVB (vbspo_calendrier.php avec saison, codent et poule)";

type TeamArgs = { clubId: string; teamId: string };

function teamArgs(request: CallableRequest): TeamArgs {
  const data = (request.data ?? {}) as Record<string, unknown>;
  return {
    clubId: requireString(data.clubId, "clubId"),
    teamId: requireString(data.teamId, "teamId"),
  };
}

/** Droit `manageTeams`, ou coach de l'équipe. */
async function assertCanManageFederation(uid: string, args: TeamArgs): Promise<void> {
  await assertPermissionOrTeamCoach({
    clubId: args.clubId,
    uid,
    permission: "manageTeams",
    teamIds: [args.teamId],
    message: "Réservé aux coachs de cette équipe et aux gestionnaires d'équipes",
  });
}

function poolRefFromRequest(request: CallableRequest): FfvbPoolRef {
  const ref = parseFfvbUrl((request.data as Record<string, unknown> | undefined)?.url);
  if (!ref) throw new HttpsError("invalid-argument", INVALID_LINK_MESSAGE);
  return ref;
}

async function loadPool(cache: PoolCache, ref: FfvbPoolRef): Promise<PoolData> {
  try {
    return await fetchFfvbPoolCached(cache, ref);
  } catch (error) {
    console.error("federation: lecture FFVB échouée", { ref, error });
    if (error instanceof FfvbFetchError) {
      throw new HttpsError("not-found", "Poule introuvable sur le site FFVB : vérifie le lien");
    }
    throw new HttpsError("unavailable", "Le site FFVB ne répond pas, réessaie dans un moment");
  }
}

async function runSync(args: TeamArgs, silent: boolean, cache: PoolCache): Promise<TeamSyncReport> {
  try {
    return await syncTeamFederation({ ...args, silent, cache });
  } catch (error) {
    throw new HttpsError(
      "unavailable",
      "Synchro FFVB impossible pour l'instant, réessaie dans un moment",
      { reason: error instanceof Error ? error.message : String(error) },
    );
  }
}

function teamRef(args: TeamArgs) {
  return db().collection("clubs").doc(args.clubId).collection("teams").doc(args.teamId);
}

async function assertTeamExists(args: TeamArgs): Promise<Record<string, unknown>> {
  const snap = await teamRef(args).get();
  if (!snap.exists) throw new HttpsError("not-found", "Équipe introuvable");
  return snap.data() ?? {};
}

/**
 * Vérifie un lien FFVB et retourne la poule et ses équipes (pour que le
 * coach choisisse la sienne). Rien n'est écrit.
 */
async function handlePreviewFederationLink(request: CallableRequest) {
  const uid = requireUid(request);
  const args = teamArgs(request);
  await assertCanManageFederation(uid, args);
  const ref = poolRefFromRequest(request);
  const pool = await loadPool(new Map(), ref);
  return {
    poolLabel: pool.poolLabel,
    teams: poolTeams(pool.standings, pool.matches),
  };
}

/**
 * Lie l'équipe à une poule FFVB et importe toute la saison en silence
 * (aucune notification à l'import).
 */
async function handleLinkTeamFederation(request: CallableRequest) {
  const uid = requireUid(request);
  const args = teamArgs(request);
  await assertCanManageFederation(uid, args);
  await assertTeamExists(args);
  const ref = poolRefFromRequest(request);
  const teamKey = requireString(
    (request.data as Record<string, unknown>).teamKey,
    "teamKey",
  );

  const cache: PoolCache = new Map();
  const pool = await loadPool(cache, ref);
  const picked = poolTeams(pool.standings, pool.matches).find(
    (team) => team.key === teamKey,
  );
  if (!picked) {
    throw new HttpsError("invalid-argument", "Cette équipe ne fait pas partie de la poule");
  }

  await teamRef(args).update({
    federation: {
      provider: FFVB_PROVIDER,
      url: ffvbCalendarUrl(ref),
      season: ref.season,
      codent: ref.codent,
      pool: ref.pool,
      poolLabel: pool.poolLabel,
      teamKey: picked.key,
      teamName: picked.name,
      linkedBy: uid,
      linkedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return runSync(args, true, cache);
}

/**
 * Délie l'équipe : supprime le lien et les données de poule. Les matchs
 * importés sont gardés, sauf `deleteImportedMatches: true` (lien erroné).
 */
async function handleUnlinkTeamFederation(request: CallableRequest) {
  const uid = requireUid(request);
  const args = teamArgs(request);
  await assertCanManageFederation(uid, args);
  await assertTeamExists(args);
  const federationRef = teamRef(args).collection(FEDERATION_SUBCOLLECTION);
  const batch = db().batch();
  batch.update(teamRef(args), {
    federation: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  batch.delete(federationRef.doc(STANDINGS_DOC));
  batch.delete(federationRef.doc(MATCHES_DOC));
  await batch.commit();
  // Après le délien : la synchro planifiée ne peut plus recréer ces matchs.
  const deleteMatches = (request.data as Record<string, unknown> | undefined)
    ?.deleteImportedMatches === true;
  const deletedMatches = deleteMatches
    ? await deleteImportedFederationEvents(args)
    : 0;
  return { ok: true, deletedMatches };
}

/**
 * Actualise maintenant (notifie les changements comme la synchro planifiée).
 * Une actualisation manuelle par équipe toutes les 10 minutes.
 */
async function handleRefreshTeamFederation(request: CallableRequest) {
  const uid = requireUid(request);
  const args = teamArgs(request);
  await assertCanManageFederation(uid, args);
  const team = await assertTeamExists(args);
  if (!readFederationLink(team)) {
    throw new HttpsError("failed-precondition", "Aucun lien fédération sur cette équipe");
  }
  const federation = team.federation as Record<string, unknown>;
  const lastManual = federation.lastManualSyncAt as admin.firestore.Timestamp | undefined;
  if (lastManual && Date.now() - lastManual.toMillis() < MANUAL_REFRESH_COOLDOWN_MS) {
    throw new HttpsError("resource-exhausted", "Déjà actualisé il y a peu, réessaie dans quelques minutes");
  }
  await teamRef(args).update({
    "federation.lastManualSyncAt": admin.firestore.FieldValue.serverTimestamp(),
  });
  return runSync(args, false, new Map());
}

export const {
  prod: previewFederationLink,
  dev: previewFederationLinkDev,
} = defineDualCallable(handlePreviewFederationLink);

export const {
  prod: linkTeamFederation,
  dev: linkTeamFederationDev,
} = defineDualCallable({ timeoutSeconds: 120 }, handleLinkTeamFederation);

export const {
  prod: unlinkTeamFederation,
  dev: unlinkTeamFederationDev,
} = defineDualCallable(handleUnlinkTeamFederation);

export const {
  prod: refreshTeamFederation,
  dev: refreshTeamFederationDev,
} = defineDualCallable({ timeoutSeconds: 120 }, handleRefreshTeamFederation);
