"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getAppFirestore } from "@/lib/firebase/app";

/**
 * Écoute en temps réel les events d'un club pour les équipes données.
 *
 * Important : on ne peut PAS faire `onSnapshot` sur toute la collection
 * pour un parent — les règles exigent `teamIds` (array-contains).
 *
 * La baseline n'est JAMAIS remise à null au refresh : on la calque sur
 * le dernier snapshot connu, sinon un event qui arrive pile au moment
 * du clic Actualiser est avalé (baseline réétablie au lieu de pastille).
 */
export function usePlanningChangeListener(
  clubId: string | null,
  teamIds: string[],
): { hasNewEvents: boolean; resetFlag: () => void } {
  const [hasNewEvents, setHasNewEvents] = useState(false);
  /** IDs au dernier acquittement (après load / Actualiser). */
  const baselineIdsRef = useRef<Set<string> | null>(null);
  /** Dernier ensemble fusionné vu par les snapshots. */
  const lastMergedRef = useRef<Set<string>>(new Set());
  const teamIdsKey = teamIds.slice().sort().join(",");

  const resetFlag = useCallback(() => {
    baselineIdsRef.current = new Set(lastMergedRef.current);
    setHasNewEvents(false);
  }, []);

  useEffect(() => {
    if (!clubId || teamIds.length === 0) return;

    const db = getAppFirestore();
    const eventsCol = collection(db, `clubs/${clubId}/events`);
    const idsByTeam = new Map<string, Set<string>>();
    const unsubscribes: Unsubscribe[] = [];

    function recompute() {
      const merged = new Set<string>();
      for (const ids of idsByTeam.values()) {
        for (const id of ids) merged.add(id);
      }
      lastMergedRef.current = merged;

      if (baselineIdsRef.current === null) {
        baselineIdsRef.current = new Set(merged);
        return;
      }

      const baseline = baselineIdsRef.current;
      let added = 0;
      for (const id of merged) {
        if (!baseline.has(id)) added += 1;
      }
      let removed = 0;
      for (const id of baseline) {
        if (!merged.has(id)) removed += 1;
      }

      if (added > 0 || removed > 0) {
        console.info("[planning] nouveaux events détectés", {
          before: baseline.size,
          after: merged.size,
          added,
          removed,
        });
        setHasNewEvents(true);
      }
    }

    for (const teamId of teamIds) {
      const teamQuery = query(
        eventsCol,
        where("teamIds", "array-contains", teamId),
      );

      const unsubscribe = onSnapshot(
        teamQuery,
        (snapshot) => {
          idsByTeam.set(
            teamId,
            new Set(snapshot.docs.map((docSnap) => docSnap.id)),
          );
          recompute();
        },
        (error) => {
          console.error("[planning] listener events en erreur", {
            teamId,
            code: error.code,
            message: error.message,
          });
        },
      );
      unsubscribes.push(unsubscribe);
    }

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teamIds via teamIdsKey
  }, [clubId, teamIdsKey]);

  return { hasNewEvents, resetFlag };
}
