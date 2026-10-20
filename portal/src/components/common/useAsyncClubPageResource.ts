"use client";

import {
  isClubResourceReady,
  useAsyncClubResource,
  type AsyncClubResourceState,
} from "@/lib/dashboard/useAsyncClubResource";
import type { ClubRecord } from "@/lib/firebase/clubService";
import { useReportPageReady } from "@/components/common/PageLoadProvider";

/**
 * `useAsyncClubResource` + signal voile page quand les données matchent le club actif.
 * Isolé dans `components/` pour ne pas coupler `lib/` au PageLoadProvider.
 */
export function useAsyncClubPageResource<T>(
  activeClub: ClubRecord | null,
  loader: (club: ClubRecord) => Promise<T>,
  deps: unknown[],
  pageRoute: string,
): AsyncClubResourceState<T> {
  const state = useAsyncClubResource(activeClub, loader, deps);
  // Club `null` (accès refusé, cible absente) : rien à charger, la page est prête.
  useReportPageReady(
    activeClub === null || isClubResourceReady(activeClub, state),
    pageRoute,
  );
  return state;
}
