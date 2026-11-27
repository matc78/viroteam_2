import type {
  DocumentData,
  DocumentReference,
  Firestore,
} from "firebase-admin/firestore";

/** Transactions menées en parallèle par [updateEachInTransaction]. */
const TRANSACTION_CONCURRENCY = 10;

/**
 * Pour chaque document de [refs] : relit dans une transaction, recalcule le
 * patch avec [buildPatch] sur la donnée fraîche, l'applique s'il n'est pas
 * `null` (une écriture concurrente ne peut pas être écrasée). Retourne le
 * nombre de documents modifiés.
 */
export async function updateEachInTransaction(
  firestore: Firestore,
  refs: DocumentReference[],
  buildPatch: (data: DocumentData) => Record<string, unknown> | null,
): Promise<number> {
  let updated = 0;
  for (let start = 0; start < refs.length; start += TRANSACTION_CONCURRENCY) {
    const results = await Promise.all(
      refs.slice(start, start + TRANSACTION_CONCURRENCY).map((ref) =>
        firestore.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return false;
          const patch = buildPatch(snap.data() ?? {});
          if (!patch) return false;
          tx.update(ref, patch);
          return true;
        }),
      ),
    );
    updated += results.filter(Boolean).length;
  }
  return updated;
}
