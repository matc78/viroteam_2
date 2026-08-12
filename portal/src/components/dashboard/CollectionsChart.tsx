import type { CollectionMonth } from "@/lib/firebase/homeService";
import styles from "./CollectionsChart.module.css";

/** Props du graphe encaissements mensuels. */
type CollectionsChartProps = {
  months: CollectionMonth[];
};

/** Barres mensuelles : encaissements CB HelloAsso vs hors-ligne. */
export function CollectionsChart({ months }: CollectionsChartProps) {
  const maxTotal = Math.max(
    ...months.map((month) => month.cardAmount + month.offlineAmount),
    1,
  );

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);

  const totalCard = months.reduce((sum, month) => sum + month.cardAmount, 0);
  const totalOffline = months.reduce(
    (sum, month) => sum + month.offlineAmount,
    0,
  );

  return (
    <section className={styles.panel} aria-labelledby="collections-title">
      <header className={styles.header}>
        <div>
          <h2 id="collections-title" className={styles.title}>
            Encaissements
          </h2>
          <p className={styles.subtitle}>CB HelloAsso vs hors-ligne</p>
        </div>
        <div className={styles.totals}>
          <span className={styles.totalCard}>{formatAmount(totalCard)} CB</span>
          <span className={styles.totalOffline}>
            {formatAmount(totalOffline)} hors-ligne
          </span>
        </div>
      </header>

      <div className={styles.chart} role="img" aria-label="Encaissements mensuels">
        {months.map((month) => {
          const total = month.cardAmount + month.offlineAmount;
          const heightPct = (total / maxTotal) * 100;
          const cardPct =
            total === 0 ? 0 : (month.cardAmount / total) * 100;

          return (
            <div key={month.month} className={styles.column}>
              <div className={styles.barTrack}>
                <div
                  className={styles.bar}
                  style={{ height: `${heightPct}%` }}
                  title={`${month.month} — CB ${formatAmount(month.cardAmount)}, hors-ligne ${formatAmount(month.offlineAmount)}`}
                >
                  <span
                    className={styles.barOffline}
                    style={{ height: `${100 - cardPct}%` }}
                  />
                  <span
                    className={styles.barCard}
                    style={{ height: `${cardPct}%` }}
                  />
                </div>
              </div>
              <span className={styles.monthLabel}>{month.month}</span>
            </div>
          );
        })}
      </div>

      <ul className={styles.legend}>
        <li className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchCard}`} aria-hidden="true" />
          HelloAsso CB
        </li>
        <li className={styles.legendItem}>
          <span
            className={`${styles.swatch} ${styles.swatchOffline}`}
            aria-hidden="true"
          />
          Hors-ligne
        </li>
      </ul>
    </section>
  );
}
