/**
 * Helpers purs « Gérer les convoqués » : liste des joueurs des équipes d’un
 * événement (cochés = convoqués) et deltas à envoyer à `updateEventConvocations`.
 */

import type {
  PlanningGuestDirectoryEntry,
  TeamOption,
} from "@/lib/firebase/eventService";

/** Ligne joueur du dialog de gestion des convoqués. */
export type ConvocationRow = {
  /** Clé stable (id roster). */
  key: string;
  /**
   * Id à envoyer au serveur : celui déjà stocké dans `teamMemberIds` ou
   * `excludedMemberIds` (même forme), sinon l’id roster.
   */
  audienceId: string;
  name: string;
  avatarUrl: string | null;
  /** Convoqué d’après l’état actuel de l’événement. */
  convoked: boolean;
};

/** Ids pointant vers la même fiche (memberId, accountUid…) dans l’annuaire. */
function aliasIds(
  id: string,
  directory: Record<string, PlanningGuestDirectoryEntry>,
): string[] {
  const entry = directory[id];
  if (!entry) return [id];
  const ids = [id];
  for (const [otherId, other] of Object.entries(directory)) {
    if (other === entry && otherId !== id) ids.push(otherId);
  }
  return ids;
}

/**
 * Joueurs des équipes de l’événement (+ exclus hors roster), dédoublonnés par
 * alias, triés par nom. Un joueur du roster pas encore synchronisé dans
 * `teamMemberIds` (et non exclu) est considéré convoqué : la synchro l’ajoutera.
 */
export function buildConvocationRows(params: {
  event: {
    teamIds: string[];
    teamMemberIds: string[];
    excludedMemberIds: string[];
  };
  teams: TeamOption[];
  directory: Record<string, PlanningGuestDirectoryEntry>;
}): ConvocationRow[] {
  const { event, teams, directory } = params;
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const memberSet = new Set(event.teamMemberIds);
  const excludedSet = new Set(event.excludedMemberIds);

  const candidateIds: string[] = [];
  for (const teamId of event.teamIds) {
    for (const playerId of teamById.get(teamId)?.playerIds ?? []) {
      if (playerId) candidateIds.push(playerId);
    }
  }
  candidateIds.push(...event.excludedMemberIds.filter(Boolean));

  const seen = new Set<string>();
  const rows: ConvocationRow[] = [];
  for (const rosterId of candidateIds) {
    if (seen.has(rosterId)) continue;
    const aliases = aliasIds(rosterId, directory);
    if (aliases.some((id) => seen.has(id))) continue;
    for (const id of aliases) seen.add(id);

    const excludedId = aliases.find((id) => excludedSet.has(id));
    const memberId = aliases.find((id) => memberSet.has(id));
    const entry = directory[rosterId];
    rows.push({
      key: rosterId,
      audienceId: excludedId ?? memberId ?? rosterId,
      name: entry?.name.trim() || "Membre",
      avatarUrl: entry?.avatarUrl ?? null,
      convoked: excludedId === undefined,
    });
  }
  return rows.sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

/**
 * Deltas à envoyer : joueurs décochés (convoqués → retirés) et recochés
 * (exclus → réintégrés). `checkedKeys` = clés des lignes cochées.
 */
export function computeConvocationDeltas(
  rows: ConvocationRow[],
  checkedKeys: Set<string>,
): { excludeIds: string[]; reintegrateIds: string[] } {
  const excludeIds: string[] = [];
  const reintegrateIds: string[] = [];
  for (const row of rows) {
    const checked = checkedKeys.has(row.key);
    if (row.convoked && !checked) excludeIds.push(row.audienceId);
    if (!row.convoked && checked) reintegrateIds.push(row.audienceId);
  }
  return { excludeIds, reintegrateIds };
}

/**
 * Gestion des convoqués possible : événement lié à au moins une équipe et pas
 * encore commencé (les séances passées ne bougent pas).
 */
export function canManageEventConvocations(
  event: { teamIds: string[]; startsAt: string },
  clock = new Date(),
): boolean {
  if (event.teamIds.length === 0) return false;
  const startsAt = new Date(event.startsAt).getTime();
  return Number.isFinite(startsAt) && startsAt > clock.getTime();
}
