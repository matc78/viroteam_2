"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import { StandingsPoolDetail } from "@/components/standings/StandingsPoolDetail";
import { StandingsTeamChips } from "@/components/standings/StandingsPickers";
import { usePoolStates } from "@/components/standings/usePoolStates";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  loadStandingsSources,
  type StandingsSources,
} from "@/lib/firebase/standingsService";
import {
  buildMyStandingsGroups,
  type StandingsEntry,
} from "@/lib/standings/standingsGroups";
import styles from "./StandingsClient.module.css";

type StandingsClientProps = {
  eyebrow?: string;
  /** True quand le panneau keep-alive est visible. */
  isPanelActive?: boolean;
};

/**
 * Page « Mes classements » (multi-clubs) : poules FFVB des équipes où le
 * compte joue ou coache, ou que ses enfants suivent. Une puce par poule,
 * puis le tableau et les matchs de la poule choisie. Le classement de tout
 * un club vit dans l’onglet Classements du club (administrateurs).
 */
export function StandingsClient({
  eyebrow = "Volley",
  isPanelActive = true,
}: StandingsClientProps) {
  const pathname = usePathname();
  const { user, profile, activeClub, bureauClubs, familyClubs } = useAuth();
  const pageRoute = pathname.startsWith("/family")
    ? "/family/standings"
    : "/standings";

  const [sources, setSources] = useState<StandingsSources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const clubs = useMemo(
    () => [...bureauClubs, ...familyClubs],
    [bureauClubs, familyClubs],
  );

  /** Sources déjà chargées pour cette clé : pas de relecture à chaque retour. */
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !profile || !isPanelActive) return;
    const key = [
      user.uid,
      profile.memberClubIds.join(","),
      clubs.map((club) => club.id).join(","),
      reloadToken,
    ].join("|");
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    let cancelled = false;
    setError(null);
    void loadStandingsSources({ profile, clubs })
      .then((result) => {
        if (cancelled) return;
        setSources(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        loadedKeyRef.current = null;
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les classements.",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
      // Chargement interrompu : à refaire au prochain passage.
      if (loadedKeyRef.current === key) loadedKeyRef.current = null;
    };
  }, [user, profile, clubs, isPanelActive, reloadToken]);

  useReportPageReady(!loading, isPanelActive ? pageRoute : null);

  const groups = useMemo(
    () =>
      sources && user
        ? buildMyStandingsGroups({
            uid: user.uid,
            clubs: sources.clubs,
            activeClubId: activeClub?.id ?? null,
          })
        : [],
    [sources, user, activeClub?.id],
  );
  const entries: StandingsEntry[] = useMemo(
    () => groups.flatMap((group) => group.entries),
    [groups],
  );
  const { pools, reset } = usePoolStates(entries);

  const selected =
    entries.find((entry) => entry.key === selectedKey) ?? entries[0] ?? null;

  const reload = useCallback(() => {
    reset();
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, [reset]);

  if (loading && !sources) {
    return <DashboardSkeleton variant="members" />;
  }

  const showClubName = groups.length > 1;

  return (
    <div className={styles.page}>
      <DashboardPageIntro
        eyebrow={eyebrow}
        heading="Mes classements"
        lead="Classements FFVB des poules de tes équipes, mis à jour par la synchro du calendrier."
        onRefresh={reload}
        refreshing={loading}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}
      {sources?.failedClubNames.length ? (
        <p className={introStyles.lead} role="status">
          Certains clubs n’ont pas pu être chargés :{" "}
          {sources.failedClubNames.join(", ")}.
        </p>
      ) : null}

      {!selected ? (
        <EmptyState title="Aucun classement pour l’instant" variant="block">
          Aucune équipe où tu joues, coaches ou que ton enfant suit n’est liée
          à une poule FFVB. Un coach peut la lier depuis l’onglet Gérer de
          l’équipe, dans l’app.
        </EmptyState>
      ) : (
        <>
          {entries.length > 1 ? (
            <StandingsTeamChips
              entries={entries}
              showClubName={showClubName}
              pools={pools}
              selectedKey={selected.key}
              onSelect={setSelectedKey}
            />
          ) : null}
          <StandingsPoolDetail
            key={selected.key}
            entry={selected}
            pool={pools[selected.key]}
            showClubName={showClubName}
          />
        </>
      )}
    </div>
  );
}
