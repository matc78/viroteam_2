import { HttpsError } from "firebase-functions/v2/https";

/** Valide clubId / invitationId (exporté pour tests unitaires Node). */
export function parseAcceptInvitationArgs(data: unknown): {
  clubId: string;
  invitationId: string;
} {
  const payload = (data ?? {}) as Record<string, unknown>;
  const clubId =
    typeof payload.clubId === "string" ? payload.clubId.trim() : "";
  const invitationId =
    typeof payload.invitationId === "string"
      ? payload.invitationId.trim()
      : "";
  if (!clubId || !invitationId) {
    throw new HttpsError("invalid-argument", "clubId et invitationId requis");
  }
  return { clubId, invitationId };
}
