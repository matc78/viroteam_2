/** Délai avant affichage : évite un flash quand le panneau est déjà en cache. */
export const NAV_LOAD_BAR_SHOW_DELAY_MS = 120;

/** Durée de la sortie (remplissage final + fondu). */
export const NAV_LOAD_BAR_EXIT_MS = 320;

/**
 * Phases de la barre de chargement des onglets :
 * `waiting` (délai anti-flash) → `filling` (progression) → `done` (fondu) → `idle`.
 */
export type NavLoadPhase = "idle" | "waiting" | "filling" | "done";

/** Événements : navigation démarrée / terminée, ou fin du timer de la phase. */
export type NavLoadEvent = "activate" | "deactivate" | "timer";

/**
 * Transition de phase de la barre de chargement.
 * Une nouvelle navigation pendant le fondu repart directement en `filling`.
 */
export function nextNavLoadPhase(
  phase: NavLoadPhase,
  event: NavLoadEvent,
): NavLoadPhase {
  switch (event) {
    case "activate":
      if (phase === "idle") return "waiting";
      if (phase === "done") return "filling";
      return phase;
    case "deactivate":
      if (phase === "waiting") return "idle";
      if (phase === "filling") return "done";
      return phase;
    case "timer":
      if (phase === "waiting") return "filling";
      if (phase === "done") return "idle";
      return phase;
  }
}

/** État de la barre : phase + identifiant du run (remonte la bande à 0). */
export type NavLoadBarState = { phase: NavLoadPhase; runId: number };

export const initialNavLoadBarState: NavLoadBarState = {
  phase: "idle",
  runId: 0,
};

/** Reducer : incrémente `runId` à chaque entrée en `filling`. */
export function navLoadBarReducer(
  state: NavLoadBarState,
  event: NavLoadEvent,
): NavLoadBarState {
  const phase = nextNavLoadPhase(state.phase, event);
  if (phase === state.phase) return state;
  return {
    phase,
    runId: phase === "filling" ? state.runId + 1 : state.runId,
  };
}
