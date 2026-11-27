"use client";

import { PoolMatchList } from "@/components/standings/PoolMatchList";
import { Icon } from "@/components/ui/icons";
import {
  displayPoolTeamName,
  type PoolTeamSeason,
} from "@/lib/standings/poolTeamSeason";
import { rankMedal } from "@/lib/standings/standingsGroups";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import styles from "./TeamSeasonPanel.module.css";

type TeamSeasonPanelProps = {
  season: PoolTeamSeason;
  /** Équipe du club (mise en avant). */
  isOwnTeam: boolean;
  onClose: () => void;
};

/**
 * Panneau latéral non modal : saison d’une équipe de la poule (rang, forme,
 * bilans, salles, parcours complet).
 */
export function TeamSeasonPanel({
  season,
  isOwnTeam,
  onClose,
}: TeamSeasonPanelProps) {
  const panelRef = useDialogA11y({ onClose, modal: false });
  const row = season.row;
  const medal = row ? rankMedal(row.rank) : null;
  const name = displayPoolTeamName(season.name);

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby="team-season-title"
    >
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>
            {isOwnTeam ? "Ton équipe" : "Adversaire"}
          </p>
          <h2 id="team-season-title" className={styles.title}>
            {name}
          </h2>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Fermer la saison"
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className={styles.body}>
        <div className={styles.hero}>
          <span className={styles.rank} data-medal={medal ?? undefined}>
            {row ? row.rank : "–"}
          </span>
          <div>
            <p className={styles.heroPoints}>
              {row ? `${row.points} pts` : "Pas encore classée"}
            </p>
            {row ? (
              <p className={styles.heroMeta}>
                {row.won} V · {row.lost} D · {row.played} joué
                {row.played > 1 ? "s" : ""}
              </p>
            ) : null}
          </div>
          {season.form.length > 0 ? (
            <ol className={styles.form} aria-label="Forme récente">
              {season.form.map((won, index) => (
                <li
                  key={index}
                  className={styles.formChip}
                  data-result={won ? "win" : "loss"}
                >
                  {won ? "V" : "D"}
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        {row ? (
          <dl className={styles.stats}>
            <div>
              <dt>Sets</dt>
              <dd>
                {row.setsFor}-{row.setsAgainst}
              </dd>
            </div>
            <div>
              <dt>Points</dt>
              <dd>
                {row.pointsFor}-{row.pointsAgainst}
              </dd>
            </div>
            <div>
              <dt>Domicile</dt>
              <dd>
                {season.homeWon} V · {season.homeLost} D
              </dd>
            </div>
            <div>
              <dt>Extérieur</dt>
              <dd>
                {season.awayWon} V · {season.awayLost} D
              </dd>
            </div>
            <div className={styles.scoreline}>
              <dt>Scores</dt>
              <dd>
                3-0 : {row.wins30} · 3-1 : {row.wins31} · 3-2 : {row.wins32} ·
                2-3 : {row.losses23} · 1-3 : {row.losses13} · 0-3 :{" "}
                {row.losses03}
                {row.forfeits > 0 ? ` · forfaits : ${row.forfeits}` : ""}
              </dd>
            </div>
          </dl>
        ) : null}

        {season.homeVenues.length > 0 ? (
          <p className={styles.venues}>
            <strong>Reçoit à :</strong> {season.homeVenues.join(" · ")}
          </p>
        ) : null}

        <PoolMatchList
          title="À venir"
          matches={season.upcoming}
          emptyLabel="Plus de match à venir."
          showVenue
        />
        <PoolMatchList
          title="Parcours"
          matches={season.played}
          emptyLabel="Pas encore de match joué."
        />
      </div>
    </div>
  );
}
