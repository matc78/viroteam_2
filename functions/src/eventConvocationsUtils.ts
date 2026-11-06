import { stringArray } from "./common";

/** Maps d'un event indexées par id d'audience, nettoyées au retrait. */
export const PER_MEMBER_EVENT_MAPS = ["rsvp", "rsvpUpdatedAt", "seenAt"] as const;

export type ConvocationPlan = {
  teamMemberIds: string[];
  excludedMemberIds: string[];
  /** Chemins `rsvp.{id}` / `rsvpUpdatedAt.{id}` / `seenAt.{id}` à supprimer. */
  deletedMapPaths: string[];
  changed: boolean;
};

/**
 * Applique retraits / réintégrations de convoqués sur un event.
 *
 * Ids = ids de fiche (une seule clé membre). Retrait : l'id quitte
 * `teamMemberIds` (et ses réponses) et rejoint `excludedMemberIds`.
 * Réintégration : l'id quitte `excludedMemberIds` et revient dans
 * `teamMemberIds` s'il en était exclu, ou toujours sur l'event ouvert par le
 * coach ([isPrimary]).
 */
export function planConvocationChange(params: {
  eventData: Record<string, unknown>;
  exclude: string[];
  reintegrate: string[];
  isPrimary: boolean;
}): ConvocationPlan {
  const { eventData, exclude, reintegrate, isPrimary } = params;
  const currentMembers = stringArray(eventData.teamMemberIds);
  const currentExcluded = stringArray(eventData.excludedMemberIds);
  const members = new Set(currentMembers);
  const excluded = new Set(currentExcluded);
  const deletedMapPaths: string[] = [];

  for (const id of exclude) {
    members.delete(id);
    for (const field of PER_MEMBER_EVENT_MAPS) {
      const values = eventData[field];
      if (values && typeof values === "object" && id in values) {
        deletedMapPaths.push(`${field}.${id}`);
      }
    }
    excluded.add(id);
  }

  for (const id of reintegrate) {
    const wasExcluded = excluded.delete(id);
    if (!members.has(id) && (wasExcluded || isPrimary)) members.add(id);
  }

  const teamMemberIds = [...members];
  const excludedMemberIds = [...excluded];
  const changed =
    !sameIds(currentMembers, teamMemberIds) ||
    !sameIds(currentExcluded, excludedMemberIds) ||
    deletedMapPaths.length > 0;

  return { teamMemberIds, excludedMemberIds, deletedMapPaths, changed };
}

function sameIds(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) return false;
  return [...leftSet].every((id) => rightSet.has(id));
}
