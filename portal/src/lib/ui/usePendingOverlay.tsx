"use client";

import { useCallback, useState, type ReactNode } from "react";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";

type PendingOverlayState = {
  pending: boolean;
  message: string;
};

/**
 * Overlay plein écran pour une action async qui se termine par une navigation.
 * `start` affiche le voile ; ne pas appeler `fail` en succès (unmount / redirect).
 */
export function usePendingOverlay(defaultMessage = "Chargement…") {
  const [state, setState] = useState<PendingOverlayState>({
    pending: false,
    message: defaultMessage,
  });

  const start = useCallback(
    (message: string = defaultMessage) => {
      setState({ pending: true, message });
    },
    [defaultMessage],
  );

  /** Coupe l’overlay uniquement en cas d’erreur (rester sur la page). */
  const fail = useCallback(() => {
    setState((current) => ({ ...current, pending: false }));
  }, []);

  const overlay: ReactNode = state.pending ? (
    <AuthLoadingState message={state.message} />
  ) : null;

  return {
    pending: state.pending,
    message: state.message,
    start,
    fail,
    overlay,
  };
}
