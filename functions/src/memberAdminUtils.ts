import { HttpsError } from "firebase-functions/v2/https";
import { requireString } from "./common";
import {
  normalizePermissions,
  unknownPermissions,
  type ClubPermission,
} from "./permissionsCatalog";

/**
 * Fonctions pures de `setMemberPermissions` / `removeMember` (testables
 * sans Firestore).
 */

/** Identifiant requis `payload[name]` (chaîne non vide). */
function requireId(payload: Record<string, unknown>, name: string): string {
  return requireString(payload[name], name);
}

/**
 * Valide `{ clubId, memberId, permissions }`. `permissions` doit être une
 * liste d'identifiants du catalogue ; elle est renvoyée normalisée.
 */
export function parseSetMemberPermissionsArgs(data: unknown): {
  clubId: string;
  memberId: string;
  permissions: ClubPermission[];
} {
  const payload = (data ?? {}) as Record<string, unknown>;
  const clubId = requireId(payload, "clubId");
  const memberId = requireId(payload, "memberId");
  if (!Array.isArray(payload.permissions)) {
    throw new HttpsError("invalid-argument", "permissions doit être une liste");
  }
  const unknown = unknownPermissions(payload.permissions);
  if (unknown.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      `Droits inconnus : ${unknown.join(", ")}`,
    );
  }
  return {
    clubId,
    memberId,
    permissions: normalizePermissions(payload.permissions),
  };
}

/** Valide `{ clubId, memberId }`. */
export function parseRemoveMemberArgs(data: unknown): {
  clubId: string;
  memberId: string;
} {
  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    clubId: requireId(payload, "clubId"),
    memberId: requireId(payload, "memberId"),
  };
}

export { accountUidOf } from "./common";

/** Décrémente un compteur sans passer sous zéro. */
export function decrementCount(raw: unknown): number {
  const current = Number(raw ?? 0);
  if (!Number.isFinite(current) || current <= 0) return 0;
  return current - 1;
}
