"use client";

import { useEffect, useState } from "react";
import type { ClubRecord } from "@/lib/firebase/clubService";

/** Etat retourne par `useAsyncClubResource`. */
type AsyncClubResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Charge une ressource liee au club actif avec annulation au demontage.
 * `deps` est serialise en cle stable pour eviter les problemes de hooks.
 */
export function useAsyncClubResource<T>(
  activeClub: ClubRecord | null,
  loader: (club: ClubRecord) => Promise<T>,
  deps: unknown[] = [],
): AsyncClubResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (!activeClub) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void loader(activeClub)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Impossible de charger les données.",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depsKey serialise les deps appelant
  }, [activeClub, reloadToken, depsKey]);

  return {
    data,
    loading,
    error,
    reload: () => setReloadToken((token) => token + 1),
  };
}
