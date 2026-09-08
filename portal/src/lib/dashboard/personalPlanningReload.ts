/** Événement window pour forcer un reload (reclic tuile déjà active). */
export const PERSONAL_PLANNING_RELOAD_EVENT = "viro:reload-personal-planning";

/** Motif d’un reload demandé hors React tree (header → panneau keep-alive). */
export type PersonalPlanningReloadDetail = {
  reason: "tile-reclick";
};

/** Demande un rechargement du panneau Mon planning (keep-alive). */
export function requestPersonalPlanningReload(
  reason: PersonalPlanningReloadDetail["reason"] = "tile-reclick",
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PersonalPlanningReloadDetail>(PERSONAL_PLANNING_RELOAD_EVENT, {
      detail: { reason },
    }),
  );
}

/**
 * S’abonne aux demandes de reload Mon planning.
 * @returns Fonction de désabonnement.
 */
export function subscribePersonalPlanningReload(
  listener: (detail: PersonalPlanningReloadDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  function onReloadRequest(event: Event) {
    const detail =
      event instanceof CustomEvent
        ? (event.detail as PersonalPlanningReloadDetail | undefined)
        : undefined;
    listener(detail ?? { reason: "tile-reclick" });
  }

  window.addEventListener(PERSONAL_PLANNING_RELOAD_EVENT, onReloadRequest);
  return () => {
    window.removeEventListener(PERSONAL_PLANNING_RELOAD_EVENT, onReloadRequest);
  };
}
