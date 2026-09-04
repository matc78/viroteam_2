"use client";

import { useEffect, useRef, useState } from "react";
import type { ClubRecord } from "@/lib/firebase/clubService";

/** Etat retourne par `useAsyncClubResource`. */
type AsyncClubResourceState<T> = {
  data: T | null;
  /** Premier chargement (pas encore de données). */
  loading: boolean;
  /** Rechargement alors que des données sont déjà affichées. */
  refreshing: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Charge une ressource liee au club actif avec annulation au demontage.
 * Conserve les données précédentes pendant un refresh (stale-while-revalidate).
 * `deps` est serialise en cle stable pour eviter les problemes de hooks.
 */
export function useAsyncClubResource<T>(
  activeClub: ClubRecord | null,
  loader: (club: ClubRecord) => Promise<T>,
  deps: unknown[] = [],
): AsyncClubResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const dataRef = useRef<T | null>(null);
  const loadedClubIdRef = useRef<string | null>(null);
  /** Toujours le loader du dernier render (évite closure stale au reload). */
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  dataRef.current = data;

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (!activeClub) {
      setData(null);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      loadedClubIdRef.current = null;
      return;
    }

    let cancelled = false;
    const isClubSwitch =
      loadedClubIdRef.current !== null &&
      loadedClubIdRef.current !== activeClub.id;
    const hasStaleData = dataRef.current !== null && !isClubSwitch;

    if (isClubSwitch) {
      setData(null);
      setLoading(true);
      setRefreshing(false);
    } else if (hasStaleData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    void loaderRef
      .current(activeClub)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        loadedClubIdRef.current = activeClub.id;
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Impossible de charger les données.",
        );
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depsKey serialise les deps appelant
  }, [activeClub, reloadToken, depsKey]);

  return {
    data,
    loading,
    refreshing,
    error,
    reload: () => setReloadToken((token) => token + 1),
  };
}
