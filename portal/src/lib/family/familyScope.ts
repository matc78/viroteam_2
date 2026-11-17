/**
 * Correspondance des données famille avec le contexte courant (club actif,
 * Moi / enfant sélectionné). Évite d’afficher ou d’utiliser, pendant un
 * rechargement, les données d’un autre club ou d’un autre enfant.
 * Logique pure (testée par vitest).
 */

/** Contexte (club, membre ciblé) auquel une donnée famille se rapporte. */
export type FamilyScope = {
  clubId: string | null;
  memberId: string | null;
};

/** True si la donnée chargée porte exactement le contexte courant. */
export function isLoadedForScope(
  loaded: FamilyScope | null | undefined,
  current: FamilyScope,
): boolean {
  if (!loaded) return false;
  return (
    loaded.clubId === current.clubId && loaded.memberId === current.memberId
  );
}

/** Résolution des cibles (Moi + enfants) pour un club donné. */
export type FamilyAudienceResolution<TTarget> = {
  /** Club pour lequel les cibles ont été résolues. */
  clubId: string | null;
  targets: TTarget[];
  selectedMemberId: string | null;
};

/**
 * Cibles exposables pour le club actif : tant que la résolution porte sur un
 * autre club, aucune cible ni sélection (jamais « nouveau club, ancien
 * enfant ») et `pending` vaut true.
 */
export function audienceForActiveClub<TTarget>(
  resolution: FamilyAudienceResolution<TTarget>,
  activeClubId: string | null,
): { targets: TTarget[]; selectedMemberId: string | null; pending: boolean } {
  if (resolution.clubId !== activeClubId) {
    return { targets: [], selectedMemberId: null, pending: true };
  }
  return {
    targets: resolution.targets,
    selectedMemberId: resolution.selectedMemberId,
    pending: false,
  };
}
