/**
 * Helpers purs de sync `teamMemberIds` ↔ rosters. Une seule clé membre :
 * roster, audience et RSVP partagent l’id de fiche (= uid si liée).
 */

/**
 * Ids du roster attendus absents de l’audience d’un événement. Un id présent
 * dans `excludedMemberIds` n’est jamais réintégré : le retrait des convoqués
 * par le coach prime sur le roster. Les invités manuels hors roster restent.
 */
export function missingAudienceIds(params: {
  currentMemberIds: string[];
  expectedMemberIds: string[];
  excludedMemberIds?: string[];
}): string[] {
  const present = new Set(params.currentMemberIds);
  const excluded = new Set(params.excludedMemberIds ?? []);
  return [
    ...new Set(
      params.expectedMemberIds.filter(
        (id) => Boolean(id) && !present.has(id) && !excluded.has(id),
      ),
    ),
  ];
}
