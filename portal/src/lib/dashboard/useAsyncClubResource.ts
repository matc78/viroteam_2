"use client";

import { useEffect, useRef, useState } from "react";
import type { ClubRecord } from "@/lib/firebase/clubService";

/** État retourné par `useAsyncClubResource`. */
export type AsyncClubResourceState<T> = {
  data: T | null;
  /** Premier chargement (pas encore de données pour le club actif). */
  loading: boolean;
  /** Rechargement alors que des données sont déjà affichées. */
  refreshing: boolean;
  error: string | null;
  /**
   * Club pour lequel le chargement s’est terminé (succès ou erreur).
   * Différent de `activeClub.id` pendant le render qui précède l’effet de switch.
   */
  loadedClubId: string | null;
  reload: () => void;
};

/**
 * Charge une ressource liée au club actif avec annulation au démontage.
 * Conserve les données précédentes pendant un refresh (stale-while-revalidate).
 * `deps` est sérialisé en clé stable pour éviter les problèmes de hooks.
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
  const [loadedClubId, setLoadedClubId] = useState<string | null>(null);
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
      setLoadedClubId(null);
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
      setLoadedClubId(null);
      loadedClubIdRef.current = null;
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
        setLoadedClubId(activeClub.id);
        loadedClubIdRef.current = activeClub.id;
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Impossible de charger les données.",
        );
        // Marque le club comme « settled » pour lever le voile page (UI d’erreur).
        setLoadedClubId(activeClub.id);
        loadedClubIdRef.current = activeClub.id;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depsKey sérialise les deps appelant
  }, [activeClub, reloadToken, depsKey]);

  return {
    data,
    loading,
    refreshing,
    error,
    loadedClubId,
    reload: () => setReloadToken((token) => token + 1),
  };
}

/**
 * True quand le hook a fini pour le club actif (données ou erreur alignées).
 * À utiliser avant `useReportPageReady` pour éviter le race keep-alive / switch club.
 */
export function isClubResourceReady(
  activeClub: ClubRecord | null,
  state: Pick<AsyncClubResourceState<unknown>, "loading" | "loadedClubId">,
): boolean {
  return (
    activeClub !== null &&
    !state.loading &&
    state.loadedClubId === activeClub.id
  );
}
