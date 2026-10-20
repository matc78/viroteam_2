const inFlight = new Map<string, Promise<unknown>>();

/**
 * Partage la même promesse entre appels concurrents de même clé (ex. équipes
 * ou saison active demandées par plusieurs loaders d’une même page).
 * Aucun cache après résolution : l’appel suivant relit Firestore.
 */
export function dedupeInFlight<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = load().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
