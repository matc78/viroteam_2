import { stringArray } from "./common";

/** Maps d'un event indexées par id d'audience, nettoyées au retrait. */
export const PER_MEMBER_EVENT_MAPS = ["rsvp", "rsvpUpdatedAt", "seenAt"] as const;

/** Joueur ciblé : id envoyé par le client + toutes ses variantes connues. */
export type ConvocationTarget = {
  id: string;
  aliases: string[];
};

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
 * Retrait : toutes les variantes quittent `teamMemberIds` (et leurs réponses),
 * l'id rejoint `excludedMemberIds`. Réintégration : les variantes quittent
 * `excludedMemberIds` ; l'id revient dans `teamMemberIds` s'il en était exclu,
 * ou toujours sur l'event ouvert par le coach ([isPrimary]).
 */
export function planConvocationChange(params: {
  eventData: Record<string, unknown>;
  exclude: ConvocationTarget[];
  reintegrate: ConvocationTarget[];
  isPrimary: boolean;
}): ConvocationPlan {
  const { eventData, exclude, reintegrate, isPrimary } = params;
  const currentMembers = stringArray(eventData.teamMemberIds);
  const currentExcluded = stringArray(eventData.excludedMemberIds);
  const members = new Set(currentMembers);
  const excluded = new Set(currentExcluded);
  const deletedMapPaths: string[] = [];

  for (const target of exclude) {
    for (const alias of target.aliases) {
      members.delete(alias);
      excluded.delete(alias);
      for (const field of PER_MEMBER_EVENT_MAPS) {
        const values = eventData[field];
        if (values && typeof values === "object" && alias in values) {
          deletedMapPaths.push(`${field}.${alias}`);
        }
      }
    }
    excluded.add(target.id);
  }

  for (const target of reintegrate) {
    const wasExcluded = target.aliases.some((alias) => excluded.has(alias));
    const isPresent = target.aliases.some((alias) => members.has(alias));
    for (const alias of target.aliases) excluded.delete(alias);
    if (!isPresent && (wasExcluded || isPrimary)) members.add(target.id);
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
