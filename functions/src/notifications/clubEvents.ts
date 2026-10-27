import type {
  DocumentReference,
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { ClubDirectory } from "./audience";

/**
 * Helpers des tâches planifiées sur les événements de tous les clubs.
 *
 * Décision (revue fiabilité, 27 oct. 2026) : une requête collection group
 * `events` par passage (index `fieldOverrides` dans firestore.indexes.json)
 * au lieu d'une requête par club — la tournée ne grossit plus avec le
 * nombre de clubs, et un événement en erreur n'arrête plus les suivants.
 */

/** Vrai pour `clubs/{clubId}/events/{eventId}` (ignore toute autre sous-collection `events`). */
export function isClubEventDoc(doc: QueryDocumentSnapshot): boolean {
  return doc.ref.parent.parent?.parent.id === "clubs";
}

/** `clubId` d'un document `clubs/{clubId}/events/{eventId}`. */
export function clubIdOfEvent(ref: DocumentReference): string {
  return ref.parent.parent!.id;
}

/** Un [ClubDirectory] par club pour tout le passage (caches partagés). */
export function clubDirectoryCache(
  firestore: Firestore,
): (clubId: string) => ClubDirectory {
  const directories = new Map<string, ClubDirectory>();
  return (clubId) => {
    let directory = directories.get(clubId);
    if (!directory) {
      directory = new ClubDirectory(firestore, clubId);
      directories.set(clubId, directory);
    }
    return directory;
  };
}

/** Log d'une étape en échec sans interrompre la tournée. */
export function logScheduledFailure(
  step: string,
  details: Record<string, unknown>,
): void {
  console.error(`notifications planifiées : ${step} échoué`, details);
}

/**
 * Réserve un envoi unique (clé de passage, ex. `weekly_digest_20261102`) :
 * `false` si un passage précédent l'a déjà fait (relance, double exécution).
 */
export async function claimScheduledRun(
  firestore: Firestore,
  runKey: string,
): Promise<boolean> {
  try {
    await firestore
      .collection("_system")
      .doc("notification_runs")
      .collection("runs")
      .doc(runKey)
      .create({ claimedAt: new Date() });
    return true;
  } catch (error) {
    // 6 = ALREADY_EXISTS
    if ((error as { code?: number }).code === 6) return false;
    throw error;
  }
}
