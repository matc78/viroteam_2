import type { DocumentData } from "firebase-admin/firestore";

/** Horodatage posé par les écritures techniques pour couper les push. */
export const SILENT_WRITE_FIELD = "silentWriteAt";

function timestampMillis(value: unknown): number | null {
  return value && typeof value === "object" && "toMillis" in value
    ? (value as { toMillis: () => number }).toMillis()
    : null;
}

/**
 * True si l'écriture pose un nouveau `silentWriteAt` : scripts `tool/` et
 * réécritures serveur qui modifient la base sans action d'un utilisateur.
 */
export function isSilentWrite(
  before: DocumentData | undefined,
  after: DocumentData,
): boolean {
  const next = timestampMillis(after[SILENT_WRITE_FIELD]);
  return next != null && next !== timestampMillis(before?.[SILENT_WRITE_FIELD]);
}
