import { displayPoolTeamName } from "@/lib/standings/poolTeamSeason";
import { rankMedal } from "@/lib/standings/standingsGroups";
import type { PoolStandingRow } from "@/lib/standings/standingsTypes";
import styles from "./StandingsTable.module.css";

type StandingsTableProps = {
  rows: PoolStandingRow[];
  /** Équipes du club suivies (lignes mises en avant). */
  highlightedKeys: Set<string>;
  /** Équipe dont la saison est ouverte (re-clic : la referme). */
  selectedKey: string | null;
  onSelectTeam: (teamKey: string) => void;
};

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/**
 * Tableau du classement d’une poule : médaille de rang (podium + 4e), équipes
 * suivies mises en avant ; un clic sur une équipe ouvre sa saison, un
 * second clic la referme.
 */
export function StandingsTable({
  rows,
  highlightedKeys,
  selectedKey,
  onSelectTeam,
}: StandingsTableProps) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="sr-only">
          Classement de la poule. Choisis une équipe pour voir sa saison.
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.rankCol}>
              <abbr title="Rang">#</abbr>
            </th>
            <th scope="col">Équipe</th>
            <th scope="col" className={styles.num}>
              <abbr title="Points">Pts</abbr>
            </th>
            <th scope="col" className={styles.num}>
              <abbr title="Matchs joués">J</abbr>
            </th>
            <th scope="col" className={styles.num}>
              <abbr title="Victoires">V</abbr>
            </th>
            <th scope="col" className={styles.num}>
              <abbr title="Défaites">D</abbr>
            </th>
            <th scope="col" className={`${styles.num} ${styles.wide}`}>
              Sets
            </th>
            <th scope="col" className={`${styles.num} ${styles.wide}`}>
              <abbr title="Différence de points">Diff.</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const medal = rankMedal(row.rank);
            const mine = highlightedKeys.has(row.key);
            const name = displayPoolTeamName(row.name);
            const opened = selectedKey === row.key;
            return (
              <tr
                key={row.key}
                className={styles.row}
                data-mine={mine ? "true" : undefined}
                data-selected={opened ? "true" : undefined}
              >
                <td className={styles.rankCol}>
                  <span className={styles.rank} data-medal={medal ?? undefined}>
                    {row.rank}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.teamButton}
                    aria-expanded={opened}
                    aria-label={`${name}, ${row.rank}e, ${row.points} points : ${opened ? "fermer" : "voir"} la saison`}
                    onClick={() => onSelectTeam(row.key)}
                  >
                    {name}
                    {mine ? <span className={styles.mineTag}>Nous</span> : null}
                  </button>
                </td>
                <td className={`${styles.num} ${styles.points}`}>
                  {row.points}
                </td>
                <td className={styles.num}>{row.played}</td>
                <td className={styles.num}>{row.won}</td>
                <td className={styles.num}>{row.lost}</td>
                <td className={`${styles.num} ${styles.wide}`}>
                  {row.setsFor}-{row.setsAgainst}
                </td>
                <td className={`${styles.num} ${styles.wide}`}>
                  {signed(row.pointsFor - row.pointsAgainst)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
