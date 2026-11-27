import {
  displayPoolTeamName,
  isPlayed,
  isWin,
  type PoolTeamMatch,
} from "@/lib/standings/poolTeamSeason";
import styles from "./PoolMatchList.module.css";

type PoolMatchListProps = {
  title: string;
  matches: PoolTeamMatch[];
  emptyLabel: string;
  /** Affiche la salle (parcours complet du panneau saison). */
  showVenue?: boolean;
};

/** Jour lisible d’un match (`sam. 28 nov.`), « Date à fixer » sinon. */
export function formatMatchDay(date: string | null): string {
  if (!date) return "Date à fixer";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Liste de matchs d’une équipe (prochains ou derniers), de son point de vue. */
export function PoolMatchList({
  title,
  matches,
  emptyLabel,
  showVenue = false,
}: PoolMatchListProps) {
  return (
    <section className={styles.section} aria-label={title}>
      <h3 className={styles.title}>{title}</h3>
      {matches.length === 0 ? (
        <p className={styles.empty}>{emptyLabel}</p>
      ) : (
        <ul className={styles.list}>
          {matches.map((match) => {
            const played = isPlayed(match);
            const won = isWin(match);
            return (
              <li
                key={match.code}
                className={styles.match}
                data-result={played ? (won ? "win" : "loss") : undefined}
              >
                <span className={styles.when}>
                  {formatMatchDay(match.date)}
                  {!played && match.time ? ` · ${match.time}` : ""}
                </span>
                <span className={styles.opponent}>
                  <span className={styles.side}>
                    {match.isHome ? "Dom." : "Ext."}
                  </span>
                  {displayPoolTeamName(match.opponentName)}
                </span>
                {played ? (
                  <span className={styles.score}>
                    <span className="sr-only">{won ? "Victoire " : "Défaite "}</span>
                    {match.us}-{match.them}
                    {match.forfeit ? (
                      <span className={styles.forfeit}> forfait</span>
                    ) : null}
                  </span>
                ) : null}
                {played && match.sets.length > 0 ? (
                  <span className={styles.sets}>{match.sets.join(" · ")}</span>
                ) : null}
                {showVenue && !played && match.venue ? (
                  <span className={styles.sets}>{match.venue}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
