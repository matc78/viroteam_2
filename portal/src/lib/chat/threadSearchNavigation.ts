/**
 * Navigation dans les résultats de recherche du fil.
 *
 * Les résultats (`findThreadSearchMatches`) sont triés du plus ancien au plus
 * récent ; la position affichée part du plus récent : `1 / n` = dernier
 * message trouvé, `n / n` = le plus ancien. « Suivant » remonte dans
 * l’historique (Entrée), « précédent » redescend (Maj+Entrée). Bouclage aux
 * extrémités.
 */

/** Sens de navigation : `older` = résultat suivant, `newer` = précédent. */
export type SearchStep = "older" | "newer";

/**
 * Position (1-based, 1 = plus récent) après un pas de navigation.
 * Aucun résultat → 0.
 */
export function stepSearchPosition(
  position: number,
  count: number,
  step: SearchStep,
): number {
  if (count <= 0) return 0;
  const current = Math.min(Math.max(position, 1), count);
  if (step === "older") return current >= count ? 1 : current + 1;
  return current <= 1 ? count : current - 1;
}

/**
 * Id du message à la position donnée (1 = plus récent), ou null si hors
 * limites. `matches` est trié du plus ancien au plus récent.
 */
export function searchMatchAtPosition(
  matches: readonly string[],
  position: number,
): string | null {
  if (position < 1 || position > matches.length) return null;
  return matches[matches.length - position] ?? null;
}

/**
 * Position à garder quand la liste de résultats change (nouveau message,
 * historique chargé) : on suit le même message s’il est toujours trouvé,
 * sinon on repart du plus récent.
 */
export function followSearchPosition(
  matches: readonly string[],
  currentId: string | null,
): number {
  if (matches.length === 0) return 0;
  if (currentId) {
    const index = matches.indexOf(currentId);
    if (index >= 0) return matches.length - index;
  }
  return 1;
}
