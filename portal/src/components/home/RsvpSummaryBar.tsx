import styles from "./RsvpSummaryBar.module.css";

/** Props du résumé des réponses à une convocation. */
type RsvpSummaryBarProps = {
  yes: number;
  no: number;
  pending: number;
  total: number;
};

/**
 * Barre empilée présents / absents / en attente + compteurs.
 * Remplace les trois grosses cases colorées des tuiles événement.
 */
export function RsvpSummaryBar({ yes, no, pending, total }: RsvpSummaryBarProps) {
  const base = Math.max(total, yes + no + pending, 1);
  const label = `${yes} présent${yes > 1 ? "s" : ""}, ${no} absent${no > 1 ? "s" : ""}, ${pending} en attente`;
  return (
    <div className={styles.root} aria-label={label} role="img">
      <div className={styles.bar} aria-hidden>
        <span
          className={styles.yes}
          style={{ width: `${(yes / base) * 100}%` }}
        />
        <span className={styles.no} style={{ width: `${(no / base) * 100}%` }} />
      </div>
      <span className={styles.counts} aria-hidden>
        <span className={styles.countYes}>{yes}</span>
        <span className={styles.sep}>/</span>
        {base}
        {pending > 0 ? (
          <span className={styles.pending}> · {pending} en attente</span>
        ) : null}
      </span>
    </div>
  );
}
