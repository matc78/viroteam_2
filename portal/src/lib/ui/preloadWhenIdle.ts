/** Délai avant de commencer à précharger (laisse passer le premier rendu). */
const PRELOAD_START_DELAY_MS = 1_500;

function onIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout: 4_000 });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = setTimeout(callback, 200);
  return () => clearTimeout(timer);
}

/**
 * Précharge des chunks JS (`() => import(...)`) un par un quand le navigateur
 * est inactif, pour que les navigations suivantes soient instantanées.
 * Retourne une fonction d’annulation (à renvoyer depuis un `useEffect`).
 */
export function preloadWhenIdle(
  loaders: Array<() => Promise<unknown>>,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  let cancelled = false;
  let cancelIdle: (() => void) | null = null;
  let index = 0;

  const next = () => {
    if (cancelled || index >= loaders.length) return;
    cancelIdle = onIdle(() => {
      const loader = loaders[index++];
      void loader()
        .catch(() => undefined)
        .finally(next);
    });
  };

  const startTimer = setTimeout(next, PRELOAD_START_DELAY_MS);
  return () => {
    cancelled = true;
    clearTimeout(startTimer);
    cancelIdle?.();
  };
}
