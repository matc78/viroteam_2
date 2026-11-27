import { stringArray } from "./common";
import { planConvocationChange, type ConvocationPlan } from "./eventConvocationsUtils";

/** Seul type d'événement où un sparring n'est pas convoqué par défaut. */
export const SPARRING_EXCLUDED_EVENT_TYPE = "match";

/** Réponse RSVP « présent » : un sparring qui l'a donnée reste convoqué. */
const RSVP_YES = "yes";

/**
 * Convocations d'un match à venir quand des joueurs passent sparring
 * ([added]), redeviennent joueurs ([removed]) ou quittent l'équipe en étant
 * sparrings ([released]).
 *
 * - Passage sparring : retiré du match (et de ses réponses), ajouté à
 *   `excludedMemberIds`, sauf s'il a déjà répondu présent ou s'il est aussi
 *   coach de l'équipe ([coachIds] : il reste convoqué comme coach).
 * - Retour joueur : réintégré s'il était exclu du match.
 * - Départ de l'équipe : son exclusion est levée (sans le reconvoquer), pour
 *   qu'un retour dans l'effectif le reconvoque normalement.
 *
 * Retourne `null` si l'event n'est pas un match actif ou si rien ne change.
 */
export function planSparringMatchChange(params: {
  eventData: Record<string, unknown>;
  added: string[];
  removed: string[];
  released?: string[];
  coachIds?: string[];
}): ConvocationPlan | null {
  const { eventData } = params;
  if (eventData.type !== SPARRING_EXCLUDED_EVENT_TYPE) return null;
  if (eventData.canceled === true) return null;

  const rsvp =
    eventData.rsvp && typeof eventData.rsvp === "object"
      ? (eventData.rsvp as Record<string, unknown>)
      : {};
  const coaches = new Set(params.coachIds ?? []);
  const excluded = new Set(stringArray(eventData.excludedMemberIds));
  const exclude = params.added.filter(
    (id) => id && !coaches.has(id) && rsvp[id] !== RSVP_YES && !excluded.has(id),
  );
  const reintegrate = params.removed.filter((id) => id && excluded.has(id));
  const released = new Set(
    (params.released ?? []).filter((id) => id && excluded.has(id)),
  );
  if (exclude.length === 0 && reintegrate.length === 0 && released.size === 0) {
    return null;
  }

  const plan = planConvocationChange({
    eventData,
    exclude,
    reintegrate,
    isPrimary: false,
  });
  if (released.size === 0) return plan.changed ? plan : null;
  return {
    ...plan,
    excludedMemberIds: plan.excludedMemberIds.filter((id) => !released.has(id)),
    changed: true,
  };
}
