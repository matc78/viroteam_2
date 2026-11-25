import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, runWithDatabase, type FirestoreDatabaseId } from "../db";
import type { PoolCache } from "./ffvbFetch";
import { FFVB_PROVIDER } from "./ffvbUrl";
import { syncTeamFederation } from "./federationSync";

const REGION = "europe-west1";

/**
 * Synchronise toutes les équipes liées à une poule FFVB (une requête par
 * poule grâce au cache partagé). Un échec d'équipe n'arrête pas les autres.
 */
export async function syncAllFederationTeams(): Promise<{ ok: number; failed: number }> {
  const snap = await db()
    .collectionGroup("teams")
    .where("federation.provider", "==", FFVB_PROVIDER)
    .get();
  const cache: PoolCache = new Map();
  let ok = 0;
  let failed = 0;
  for (const doc of snap.docs) {
    const clubId = doc.ref.parent.parent?.id;
    if (!clubId) continue;
    try {
      await syncTeamFederation({ clubId, teamId: doc.id, silent: false, cache });
      ok += 1;
    } catch {
      failed += 1; // déjà journalisé + `lastSyncStatus: "error"` sur l'équipe
    }
  }
  console.log("syncFederationTeams", { ok, failed });
  return { ok, failed };
}

function defineFederationSyncSchedule(databaseId: FirestoreDatabaseId) {
  return onSchedule(
    {
      // Tous les 2 jours à 5h : les changements FFVB sont rares, la synchro
      // reste discrète pour le site de la fédération.
      schedule: "0 5 */2 * *",
      timeZone: "Europe/Paris",
      region: REGION,
      timeoutSeconds: 540,
    },
    async () => {
      await runWithDatabase(databaseId, () => syncAllFederationTeams());
    },
  );
}

export const syncFederationTeams = defineFederationSyncSchedule("v2-prod");
export const syncFederationTeamsDev = defineFederationSyncSchedule("v2-dev");
