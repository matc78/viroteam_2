"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPoolData } from "@/lib/firebase/standingsService";
import type { StandingsEntry } from "@/lib/standings/standingsGroups";
import type { PoolData } from "@/lib/standings/standingsTypes";

/** État de chargement de la poule d’une entrée. */
export type PoolState =
  | { status: "loading" }
  | { status: "ready"; data: PoolData }
  | { status: "error" };

/**
 * Charge (une fois) la poule de chaque entrée de [entries] : rangs de la
 * liste et tableau de la poule sélectionnée. `reset` vide le cache et
 * recharge les entrées courantes (bouton Actualiser) ; une réponse d'avant
 * le reset est ignorée.
 */
export function usePoolStates(entries: readonly StandingsEntry[]): {
  pools: Record<string, PoolState>;
  reset: () => void;
} {
  const [pools, setPools] = useState<Record<string, PoolState>>({});
  const requested = useRef(new Set<string>());
  const generation = useRef(0);
  const [resetCount, setResetCount] = useState(0);

  useEffect(() => {
    const current = generation.current;
    for (const entry of entries) {
      if (requested.current.has(entry.key)) continue;
      requested.current.add(entry.key);
      setPools((pools) => ({ ...pools, [entry.key]: { status: "loading" } }));
      const primary = entry.teams[0]!;
      void loadPoolData(entry.clubId, primary.id)
        .then((data) => {
          if (generation.current !== current) return;
          setPools((pools) => ({
            ...pools,
            [entry.key]: { status: "ready", data },
          }));
        })
        .catch(() => {
          if (generation.current !== current) return;
          setPools((pools) => ({ ...pools, [entry.key]: { status: "error" } }));
        });
    }
  }, [entries, resetCount]);

  const reset = useCallback(() => {
    generation.current += 1;
    requested.current.clear();
    setPools({});
    // Recharge aussi si les entrées ne changent pas (actualisation en échec).
    setResetCount((count) => count + 1);
  }, []);

  return { pools, reset };
}
