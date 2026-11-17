import { stringArray } from "./common";

/**
 * Règles pures du RSVP serveur (`setEventRsvp`), testables avec `node --test`.
 */

/**
 * True si [memberId] peut servir de clé de map Firestore dans un chemin
 * pointé (`rsvp.{memberId}`) : non vide, sans « . » (chemin imbriqué) ni
 * « / », et pas un id réservé `__…__`.
 */
export function isSafeMemberMapKey(memberId: string): boolean {
  return (
    memberId.length > 0 &&
    memberId.length <= 128 &&
    !memberId.includes(".") &&
    !memberId.includes("/") &&
    !/^__.*__$/.test(memberId)
  );
}

/** Issue du contrôle de cible d'un RSVP posé par l'encadrement. */
export type StaffRsvpTargetDecision =
  | { ok: true }
  | { ok: false; code: "not-found" | "failed-precondition" | "permission-denied"; reason: string };

/**
 * Le staff (droit `manageEvents` ou coach autorisé) ne répond que pour une
 * fiche existante convoquée sur l'événement (`teamMemberIds`) ; un coach sans
 * droit club, seulement pour un membre d'une de ses équipes.
 */
export function staffRsvpTargetDecision(params: {
  event: Record<string, unknown>;
  targetMemberId: string;
  targetExists: boolean;
  targetTeamIds: readonly string[];
  canManageEvents: boolean;
  coachTeamIds: readonly string[];
}): StaffRsvpTargetDecision {
  if (!params.targetExists) {
    return { ok: false, code: "not-found", reason: "Fiche membre introuvable" };
  }
  if (!stringArray(params.event.teamMemberIds).includes(params.targetMemberId)) {
    return {
      ok: false,
      code: "failed-precondition",
      reason: "Ce membre n’est pas convoqué sur cet événement",
    };
  }
  if (params.canManageEvents) return { ok: true };
  const coached = new Set(params.coachTeamIds);
  if (!params.targetTeamIds.some((teamId) => coached.has(teamId))) {
    return {
      ok: false,
      code: "permission-denied",
      reason: "Ce joueur n’est dans aucune de tes équipes",
    };
  }
  return { ok: true };
}
