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

type PlanningChangeListenerResult = {
  hasNewEvents: boolean;
  resetFlag: () => void;
};

/**
 * Écoute en temps réel les events d'un club pour les équipes données.
 *
 * Important : on ne peut PAS faire `onSnapshot` sur toute la collection
 * pour un parent — les règles exigent `teamIds` (array-contains).
 *
 * La baseline n'est JAMAIS remise à null au refresh : on la calque sur
 * le dernier snapshot connu, sinon un event qui arrive pile au moment
 * du clic Actualiser est avalé (baseline réétablie au lieu de pastille).
 *
 * On n'compare à la baseline qu'une fois que **toutes** les équipes ont
 * reporté — sinon le 2ᵉ snapshot allume à tort « Actualiser ».
 *
 * @param enabled Si false, aucune souscription (ex. panneau keep-alive masqué).
 */
export function usePlanningChangeListener(
  clubId: string | null,
  teamIds: string[],
  enabled = true,
): PlanningChangeListenerResult {
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
    if (!enabled || !clubId || teamIds.length === 0) return;

    // Nouvelle souscription → le prochain snapshot complet est la baseline.
    baselineIdsRef.current = null;

    const db = getAppFirestore();
    const eventsCol = collection(db, `clubs/${clubId}/events`);
    const idsByTeam = new Map<string, Set<string>>();
    const expectedTeamCount = teamIds.length;
    const unsubscribes: Unsubscribe[] = [];

    function recompute() {
      const merged = new Set<string>();
      for (const ids of idsByTeam.values()) {
        for (const id of ids) merged.add(id);
      }
      lastMergedRef.current = merged;

      // Snapshots partiels (équipes pas encore toutes arrivées) → pas de diff.
      if (idsByTeam.size < expectedTeamCount) return;

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
  }, [clubId, teamIdsKey, enabled]);

  return { hasNewEvents, resetFlag };
}

/**
 * Écoute multi-clubs (planning perso) : une query par équipe et par club.
 * Même logique de baseline que `usePlanningChangeListener`.
 *
 * @param enabled Si false, aucune souscription (ex. panneau keep-alive masqué).
 */
export function useMultiClubPlanningChangeListener(
  targets: Array<{ clubId: string; teamIds: string[] }>,
  enabled = true,
): PlanningChangeListenerResult {
  const [hasNewEvents, setHasNewEvents] = useState(false);
  const baselineIdsRef = useRef<Set<string> | null>(null);
  const lastMergedRef = useRef<Set<string>>(new Set());
  const targetsKey = targets
    .map(
      (target) =>
        `${target.clubId}:${[...target.teamIds].sort().join(",")}`,
    )
    .sort()
    .join("|");

  const resetFlag = useCallback(() => {
    baselineIdsRef.current = new Set(lastMergedRef.current);
    setHasNewEvents(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const flat = targets.flatMap((target) =>
      target.teamIds
        .filter(Boolean)
        .map((teamId) => ({ clubId: target.clubId, teamId })),
    );
    if (flat.length === 0) return;

    // Nouvelle souscription → le prochain snapshot complet est la baseline.
    baselineIdsRef.current = null;

    const db = getAppFirestore();
    const idsByKey = new Map<string, Set<string>>();
    const expectedQueryCount = flat.length;
    const unsubscribes: Unsubscribe[] = [];

    function recompute() {
      const merged = new Set<string>();
      for (const [key, ids] of idsByKey) {
        for (const id of ids) merged.add(`${key}:${id}`);
      }
      lastMergedRef.current = merged;

      if (idsByKey.size < expectedQueryCount) return;

      if (baselineIdsRef.current === null) {
        baselineIdsRef.current = new Set(merged);
        return;
      }

      const baseline = baselineIdsRef.current;
      let changed = false;
      for (const id of merged) {
        if (!baseline.has(id)) {
          changed = true;
          break;
        }
      }
      if (!changed) {
        for (const id of baseline) {
          if (!merged.has(id)) {
            changed = true;
            break;
          }
        }
      }
      if (changed) setHasNewEvents(true);
    }

    for (const { clubId, teamId } of flat) {
      const key = `${clubId}::${teamId}`;
      const eventsCol = collection(db, `clubs/${clubId}/events`);
      const teamQuery = query(
        eventsCol,
        where("teamIds", "array-contains", teamId),
      );
      const unsubscribe = onSnapshot(
        teamQuery,
        (snapshot) => {
          idsByKey.set(
            key,
            new Set(snapshot.docs.map((docSnap) => docSnap.id)),
          );
          recompute();
        },
        (error) => {
          console.error("[planning] listener multi-club en erreur", {
            clubId,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- targets via targetsKey
  }, [targetsKey, enabled]);

  return { hasNewEvents, resetFlag };
}
