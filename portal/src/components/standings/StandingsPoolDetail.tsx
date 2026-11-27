"use client";

import { useState } from "react";
import { PoolMatchList } from "@/components/standings/PoolMatchList";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { TeamSeasonPanel } from "@/components/standings/TeamSeasonPanel";
import type { PoolState } from "@/components/standings/usePoolStates";
import { EmptyState } from "@/components/ui/EmptyState";
import { buildPoolTeamSeason } from "@/lib/standings/poolTeamSeason";
import {
  entryLabel,
  entryPoolLabel,
  entryTeamKeys,
  type StandingsEntry,
} from "@/lib/standings/standingsGroups";
import styles from "./StandingsClient.module.css";

type StandingsPoolDetailProps = {
  entry: StandingsEntry;
  pool: PoolState | undefined;
  /** Rappelle le club au-dessus du titre (page multi-clubs). */
  showClubName: boolean;
};

/**
 * Poule sélectionnée : en-tête (équipe, poule, synchro), tableau du
 * classement, prochains matchs / derniers résultats de l’équipe et saison
 * détaillée d’une équipe au clic. Monter avec `key={entry.key}` pour
 * refermer la saison ouverte au changement de poule.
 */
export function StandingsPoolDetail({
  entry,
  pool,
  showClubName,
}: StandingsPoolDetailProps) {
  const [seasonTeamKey, setSeasonTeamKey] = useState<string | null>(null);
  const data = pool?.status === "ready" ? pool.data : null;
  const highlighted = entryTeamKeys(entry);
  const primaryKey = entry.teams[0]?.federation.teamKey ?? null;
  const primarySeason =
    data && primaryKey
      ? buildPoolTeamSeason({
          standings: data.standings,
          matches: data.matches,
          teamKey: primaryKey,
        })
      : null;
  const openedSeason =
    data && seasonTeamKey
      ? buildPoolTeamSeason({
          standings: data.standings,
          matches: data.matches,
          teamKey: seasonTeamKey,
        })
      : null;
  const eyebrow = [
    showClubName ? entry.clubName : null,
    entry.childNames.join(", ") || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const poolLabel = entryPoolLabel(entry);

  return (
    <div className={styles.main}>
      <header className={styles.poolHeader}>
        <div className={styles.poolHeading}>
          {eyebrow ? <p className={styles.poolEyebrow}>{eyebrow}</p> : null}
          <h2 className={styles.poolTitle}>{entryLabel(entry)}</h2>
          {poolLabel ? <p className={styles.poolLabel}>{poolLabel}</p> : null}
        </div>
        <PoolSyncInfo
          fetchedAt={data?.standings?.fetchedAt ?? null}
          failed={entry.teams.some((team) => team.federation.lastSyncFailed)}
        />
      </header>

      {pool?.status === "error" ? (
        <p className={styles.error} role="alert">
          Impossible de charger cette poule.
        </p>
      ) : !data ? (
        <p className={styles.muted} aria-live="polite">
          Chargement du classement…
        </p>
      ) : data.standings && data.standings.rows.length > 0 ? (
        <StandingsTable
          rows={data.standings.rows}
          highlightedKeys={highlighted}
          selectedKey={seasonTeamKey}
          // Re-clic sur la ligne de l’équipe ouverte : referme sa saison.
          onSelectTeam={(teamKey) =>
            setSeasonTeamKey((current) => (current === teamKey ? null : teamKey))
          }
        />
      ) : (
        <EmptyState>Le classement n’est pas encore publié par la FFVB.</EmptyState>
      )}

      {primarySeason ? (
        <div className={styles.matchColumns}>
          <PoolMatchList
            title="Prochains matchs"
            matches={primarySeason.upcoming.slice(0, 4)}
            emptyLabel="Plus de match à venir cette saison."
          />
          <PoolMatchList
            title="Derniers résultats"
            matches={primarySeason.played.slice(0, 4)}
            emptyLabel="Pas encore de match joué."
          />
        </div>
      ) : null}

      {openedSeason ? (
        <TeamSeasonPanel
          season={openedSeason}
          isOwnTeam={highlighted.has(openedSeason.key)}
          onClose={() => setSeasonTeamKey(null)}
        />
      ) : null}
    </div>
  );
}

/** Date de mise à jour du classement (ou échec de la dernière synchro). */
function PoolSyncInfo({
  fetchedAt,
  failed,
}: {
  fetchedAt: Date | null;
  failed: boolean;
}) {
  if (!fetchedAt && !failed) return null;
  return (
    <p className={styles.syncInfo} data-failed={failed ? "true" : undefined}>
      {failed
        ? "Dernière synchro en échec, données précédentes affichées"
        : `Mis à jour le ${fetchedAt!.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
          })} à ${fetchedAt!.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`}
    </p>
  );
}
