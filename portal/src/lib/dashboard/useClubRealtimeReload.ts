"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type CollectionReference,
  type Query,
  type Unsubscribe,
} from "firebase/firestore";
import { getAppFirestore } from "@/lib/firebase/app";
import { Collections, Fields } from "@/lib/firebase/constants";
import { getActiveSeason } from "@/lib/firebase/feeService";

const DEFAULT_DEBOUNCE_MS = 350;

/** True si le pathname correspond à une des routes (keep-alive actif). */
export function useIsPortalRouteActive(routes: readonly string[]): boolean {
  const pathname = usePathname();
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export type ClubRealtimeReloadOptions = {
  clubId: string | null | undefined;
  /** Collections relatives sous `clubs/{clubId}/` (ex. `members`, `events`). */
  collections?: readonly string[];
  /**
   * Écoute `fee_seasons` + cotisations de la saison active.
   * Sans `memberFeeIds` (`undefined`) : collection entière (admin/coach).
   * Avec `memberFeeIds` : docs individuels (joueur/parent — rules).
   * Tableau vide = en attente des ids (pas d’écoute collection, sinon permission-denied).
   */
  listenActiveMemberFees?: boolean;
  /** Ids de fiches `member_fees` à écouter ; omis = liste complète. */
  memberFeeIds?: readonly string[];
  /** Déclenché après le 1er snapshot (baseline), debounce inclus. */
  onReload: () => void;
  /** Coupe les souscriptions (panneau keep-alive inactif). */
  enabled?: boolean;
  debounceMs?: number;
};

/**
 * Requête écoutée pour une collection club. Les collections qui grossissent
 * sans fin sont bornées (sinon chaque snapshot initial relit tout
 * l'historique) :
 * - `events` : à partir d'hier (les tableaux de bord n'affichent que l'à venir) ;
 * - `activity_events` (append-only) : la dernière entrée suffit à détecter un ajout.
 */
function realtimeQuery(
  ref: CollectionReference,
  relativePath: string,
): Query | CollectionReference {
  if (relativePath === Collections.events) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 1);
    return query(ref, where(Fields.date, ">=", Timestamp.fromDate(since)));
  }
  if (relativePath === Collections.activityEvents) {
    return query(ref, orderBy(Fields.createdAt, "desc"), limit(1));
  }
  return ref;
}

/** Log listener Firestore sans overlay Next (`console.error` = erreur runtime en dev). */
function logRealtimeError(
  label: string,
  details: Record<string, unknown>,
  error: { code?: string; message?: string },
): void {
  console.warn(`[realtime] ${label}`, {
    ...details,
    code: error.code,
    message: error.message,
  });
}

/**
 * Recharge automatiquement une ressource club quand Firestore change.
 * Ignore le premier snapshot de chaque query (baseline), debounce les suivants.
 */
export function useClubRealtimeReload({
  clubId,
  collections = [],
  listenActiveMemberFees = false,
  memberFeeIds,
  onReload,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: ClubRealtimeReloadOptions): void {
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;

  const collectionsKey = [...collections].sort().join("|");
  /** `undefined` = mode collection ; sinon ids (éventuellement vides = attente). */
  const memberFeeIdsKey =
    memberFeeIds === undefined
      ? "__all__"
      : [...memberFeeIds].filter(Boolean).sort().join("|");

  useEffect(() => {
    if (!enabled || !clubId) return;
    if (
      collections.length === 0 &&
      !listenActiveMemberFees
    ) {
      return;
    }

    const resolvedClubId: string = clubId;
    const db = getAppFirestore();
    const unsubscribes: Unsubscribe[] = [];
    const feeUnsubs: Unsubscribe[] = [];
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let activeSeasonId: string | null = null;
    const scopedFeeMode = memberFeeIdsKey !== "__all__";
    const scopedFeeIds = scopedFeeMode
      ? memberFeeIdsKey.split("|").filter(Boolean)
      : [];

    const primedKeys = new Set<string>();

    function scheduleReload(sourceKey: string) {
      if (!primedKeys.has(sourceKey)) {
        primedKeys.add(sourceKey);
        return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (!cancelled) onReloadRef.current();
      }, debounceMs);
    }

    function clearFeeListeners() {
      for (const unsubscribe of feeUnsubs) unsubscribe();
      feeUnsubs.length = 0;
    }

    function watchCollection(relativePath: string, key = relativePath) {
      const segments = relativePath.split("/").filter(Boolean);
      const ref = collection(
        db,
        Collections.clubs,
        resolvedClubId,
        ...segments,
      );
      unsubscribes.push(
        onSnapshot(
          realtimeQuery(ref, relativePath),
          () => scheduleReload(key),
          (error) => {
            logRealtimeError(
              "listener collection en erreur",
              { clubId: resolvedClubId, path: relativePath },
              error,
            );
          },
        ),
      );
    }

    for (const relativePath of collections) {
      if (
        listenActiveMemberFees &&
        relativePath === Collections.feeSeasons
      ) {
        continue;
      }
      watchCollection(relativePath);
    }

    if (listenActiveMemberFees) {
      function attachMemberFees(seasonId: string) {
        clearFeeListeners();
        if (activeSeasonId !== seasonId) {
          for (const key of [...primedKeys]) {
            if (key.startsWith("__member_fee")) primedKeys.delete(key);
          }
        }
        // Mode joueur/parent : attendre les ids (ne jamais lister la collection).
        if (scopedFeeMode && scopedFeeIds.length === 0) {
          return;
        }

        activeSeasonId = seasonId;

        if (scopedFeeMode) {
          for (const memberId of scopedFeeIds) {
            const feeRef = doc(
              db,
              Collections.clubs,
              resolvedClubId,
              Collections.feeSeasons,
              seasonId,
              Collections.memberFees,
              memberId,
            );
            const key = `__member_fee:${memberId}`;
            feeUnsubs.push(
              onSnapshot(
                feeRef,
                () => scheduleReload(key),
                (error) => {
                  logRealtimeError(
                    "listener member_fee doc en erreur",
                    { clubId: resolvedClubId, seasonId, memberId },
                    error,
                  );
                },
              ),
            );
          }
          return;
        }

        const feesRef = collection(
          db,
          Collections.clubs,
          resolvedClubId,
          Collections.feeSeasons,
          seasonId,
          Collections.memberFees,
        );
        feeUnsubs.push(
          onSnapshot(
            feesRef,
            () => scheduleReload("__member_fees__"),
            (error) => {
              logRealtimeError(
                "listener member_fees en erreur",
                { clubId: resolvedClubId, seasonId },
                error,
              );
            },
          ),
        );
      }

      async function syncActiveSeasonFees() {
        try {
          const season = await getActiveSeason(resolvedClubId);
          if (cancelled) return;
          if (!season) {
            clearFeeListeners();
            activeSeasonId = null;
            primedKeys.add("__member_fees__");
            return;
          }
          if (season.id !== activeSeasonId) {
            attachMemberFees(season.id);
          }
        } catch (error) {
          console.warn("[realtime] résolution saison active impossible", error);
          primedKeys.add("__member_fees__");
        }
      }

      const seasonsRef = collection(
        db,
        Collections.clubs,
        resolvedClubId,
        Collections.feeSeasons,
      );
      unsubscribes.push(
        onSnapshot(
          seasonsRef,
          () => {
            scheduleReload("__fee_seasons__");
            void syncActiveSeasonFees();
          },
          (error) => {
            logRealtimeError(
              "listener fee_seasons en erreur",
              { clubId: resolvedClubId },
              error,
            );
          },
        ),
      );
    }

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      clearFeeListeners();
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys sérialisées
  }, [
    clubId,
    collectionsKey,
    listenActiveMemberFees,
    memberFeeIdsKey,
    enabled,
    debounceMs,
  ]);
}

/** Sets de collections courants pour les dashboards portail. */
export const ClubListenSets = {
  homeAdmin: [
    Collections.members,
    Collections.events,
    Collections.teams,
    Collections.announcements,
  ],
  homeCoach: [Collections.members, Collections.events, Collections.teams],
  homePlayer: [
    Collections.members,
    Collections.events,
    Collections.teams,
    Collections.announcements,
  ],
  fees: [] as string[],
  members: [
    Collections.members,
    Collections.teams,
    Collections.invitations,
  ],
  team: [Collections.members, Collections.teams],
  announcements: [Collections.announcements, Collections.teams],
  equipment: [Collections.equipment],
  activity: [Collections.activityEvents],
  /** Famille : pas de list events/members (rules) — fees via memberFeeIds. */
  familyHome: [] as string[],
  familyFees: [] as string[],
  familyTeam: [] as string[],
  planning: [Collections.teams, Collections.members],
} as const;
