"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import { StandingsCategoryList } from "@/components/standings/StandingsPickers";
import { StandingsPoolDetail } from "@/components/standings/StandingsPoolDetail";
import { usePoolStates } from "@/components/standings/usePoolStates";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { loadClubStandingsSource } from "@/lib/firebase/standingsService";
import {
  buildClubStandingsCategories,
  type StandingsClubSource,
} from "@/lib/standings/standingsGroups";
import { isVolleyballSport } from "@/lib/standings/standingsTypes";
import styles from "./StandingsClient.module.css";

const PAGE_ROUTE = "/club-standings";

/** Source chargée pour un club donné (évite d’afficher l’ancien club). */
type LoadedSource = { clubId: string; source: StandingsClubSource };

/**
 * Onglet Classements du club actif (administrateurs) : toutes les poules
 * FFVB des équipes du club, groupées par catégorie dans une colonne
 * compacte, puis le tableau et les matchs de la poule choisie.
 */
export function ClubStandingsClient() {
  const { activeClub } = useAuth();
  const isVolley = isVolleyballSport(activeClub?.sport);
  const [loaded, setLoaded] = useState<LoadedSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!activeClub) return;
    if (!isVolleyballSport(activeClub.sport)) {
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    void loadClubStandingsSource(activeClub)
      .then((source) => {
        if (cancelled) return;
        setLoaded({ clubId: activeClub.id, source });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les classements du club.",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeClub, reloadToken]);

  const source =
    loaded && loaded.clubId === activeClub?.id ? loaded.source : null;
  useReportPageReady(
    Boolean(activeClub) && (!isVolley || error !== null || source !== null),
    PAGE_ROUTE,
  );
  const groups = useMemo(
    () => (source ? buildClubStandingsCategories(source) : []),
    [source],
  );
  const entries = useMemo(
    () => groups.flatMap((group) => group.entries),
    [groups],
  );
  const { pools, reset } = usePoolStates(entries);

  const selected =
    entries.find((entry) => entry.key === selectedKey) ?? entries[0] ?? null;

  const reload = useCallback(() => {
    reset();
    setReloadToken((token) => token + 1);
  }, [reset]);

  if (isVolley && loading && !source) {
    return <DashboardSkeleton variant="members" />;
  }

  return (
    <div className={styles.page}>
      <DashboardPageIntro
        eyebrow={activeClub?.name ?? "Espace club"}
        heading="Classements"
        lead="Classements FFVB de toutes les équipes du club, mis à jour par la synchro du calendrier."
        onRefresh={isVolley ? reload : undefined}
        refreshing={loading}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {!isVolley ? (
        <EmptyState title="Classements réservés au volley" variant="block">
          Les classements viennent de la FFVB : ils s’affichent pour les clubs
          de volley.
        </EmptyState>
      ) : !selected ? (
        <EmptyState title="Aucune équipe liée à une poule" variant="block">
          Les classements apparaissent quand un coach lie une équipe à sa
          poule FFVB (onglet Gérer de l’équipe, dans l’app).
        </EmptyState>
      ) : (
        <div className={styles.layout}>
          <StandingsCategoryList
            groups={groups}
            pools={pools}
            selectedKey={selected.key}
            onSelect={setSelectedKey}
          />
          <StandingsPoolDetail
            key={selected.key}
            entry={selected}
            pool={pools[selected.key]}
            showClubName={false}
          />
        </div>
      )}
    </div>
  );
}
