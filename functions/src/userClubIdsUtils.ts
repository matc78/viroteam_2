/**
 * Helpers purs de `users/{uid}.memberClubIds` (testables avec `node --test`).
 *
 * Décision (revue données personnelles, 27 oct. 2026) : `users/{uid}` n'est
 * plus lisible par tout compte connecté, seulement par son titulaire et par
 * les comptes qui partagent un club avec lui (membre ou parent). Les règles
 * comparent les listes `memberClubIds` + `parentClubIds` des deux comptes ;
 * `memberClubIds` est recalculé côté serveur (jamais par le client), car
 * `clubMemberships` reste modifiable par son titulaire.
 */

/** Ids de club déclarés dans `clubMemberships` (dédupliqués, triés). */
export function declaredClubIds(clubMemberships: unknown): string[] {
  if (!Array.isArray(clubMemberships)) return [];
  const ids = new Set<string>();
  for (const entry of clubMemberships) {
    if (!entry || typeof entry !== "object") continue;
    const clubId = String((entry as { clubId?: unknown }).clubId ?? "").trim();
    if (clubId) ids.add(clubId);
  }
  return [...ids].sort();
}

/** Vrai si les deux listes contiennent les mêmes ids (ordre indifférent). */
export function sameClubIds(current: unknown, next: string[]): boolean {
  const currentIds = Array.isArray(current)
    ? [...new Set(current.map((id) => String(id)))].sort()
    : null;
  if (!currentIds) return false;
  return (
    currentIds.length === next.length &&
    currentIds.every((id, index) => id === next[index])
  );
}
