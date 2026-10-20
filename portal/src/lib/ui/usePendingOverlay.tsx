"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { useToast } from "@/components/ToastProvider";
import { sessionCopy } from "@/lib/copy/sessionCopy";

type PendingOverlayState = {
  pending: boolean;
  message: string;
};

type PendingOverlayOptions = {
  /**
   * Filet de sécurité : coupe le voile après ce délai (toast d’erreur + `onTimeout`).
   * À réserver aux actions rejouables sans risque (pas la création de club).
   */
  timeoutMs?: number;
  /** Appelé quand le filet de sécurité coupe le voile (ex. réactiver le formulaire). */
  onTimeout?: () => void;
};

/**
 * Overlay plein écran pour une action async qui se termine par une navigation.
 * `start` affiche le voile ; ne pas appeler `fail` en succès (unmount / redirect).
 */
export function usePendingOverlay(
  defaultMessage = "Chargement…",
  options?: PendingOverlayOptions,
) {
  const [state, setState] = useState<PendingOverlayState>({
    pending: false,
    message: defaultMessage,
  });
  const { showToast } = useToast();
  const timeoutMs = options?.timeoutMs;
  const onTimeoutRef = useRef(options?.onTimeout);
  onTimeoutRef.current = options?.onTimeout;

  useEffect(() => {
    if (!state.pending || !timeoutMs) return;
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, pending: false }));
      showToast(sessionCopy.pendingTimeout, "error");
      onTimeoutRef.current?.();
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [state.pending, timeoutMs, showToast]);

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
