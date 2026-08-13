import type { CollectionMonth } from "@/lib/firebase/homeService";
import panelStyles from "./DashboardPanel.module.css";
import styles from "./CollectionsChart.module.css";

/** Props du graphe encaissements mensuels. */
type CollectionsChartProps = {
  months: CollectionMonth[];
  /** Affiche la série CB HelloAsso (paiement en ligne activé sur le club). */
  showHelloAsso?: boolean;
};

/** Barres mensuelles : encaissements CB HelloAsso vs hors-ligne. */
export function CollectionsChart({
  months,
  showHelloAsso = false,
}: CollectionsChartProps) {
  const maxTotal = Math.max(
    ...months.map((month) =>
      showHelloAsso
        ? month.cardAmount + month.offlineAmount
        : month.offlineAmount,
    ),
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
    <section
      className={panelStyles.panel}
      data-tone="blue"
      aria-labelledby="collections-title"
    >
      <header className={styles.header}>
        <div>
          <h2 id="collections-title" className={styles.title}>
            Encaissements
          </h2>
          <p className={styles.subtitle}>
            {showHelloAsso ? "CB HelloAsso vs hors-ligne" : "Paiements hors-ligne"}
          </p>
        </div>
        <div className={styles.totals}>
          {showHelloAsso ? (
            <span className={styles.totalCard}>
              {formatAmount(totalCard)} CB
            </span>
          ) : null}
          <span className={styles.totalOffline}>
            {formatAmount(totalOffline)} hors-ligne
          </span>
        </div>
      </header>

      <div className={styles.chart} role="img" aria-label="Encaissements mensuels">
        {months.map((month) => {
          const total = showHelloAsso
            ? month.cardAmount + month.offlineAmount
            : month.offlineAmount;
          const heightPct = (total / maxTotal) * 100;
          const cardPct =
            !showHelloAsso || total === 0
              ? 0
              : (month.cardAmount / total) * 100;

          const barTitle = showHelloAsso
            ? `${month.month} — CB ${formatAmount(month.cardAmount)}, hors-ligne ${formatAmount(month.offlineAmount)}`
            : `${month.month} — hors-ligne ${formatAmount(month.offlineAmount)}`;

          return (
            <div key={month.month} className={styles.column}>
              <div className={styles.barTrack}>
                <div
                  className={styles.bar}
                  style={{ height: `${heightPct}%` }}
                  title={barTitle}
                >
                  <span
                    className={styles.barOffline}
                    style={{ height: `${100 - cardPct}%` }}
                  />
                  {showHelloAsso ? (
                    <span
                      className={styles.barCard}
                      style={{ height: `${cardPct}%` }}
                    />
                  ) : null}
                </div>
              </div>
              <span className={styles.monthLabel}>{month.month}</span>
            </div>
          );
        })}
      </div>

      <ul className={styles.legend}>
        {showHelloAsso ? (
          <li className={styles.legendItem}>
            <span
              className={`${styles.swatch} ${styles.swatchCard}`}
              aria-hidden="true"
            />
            HelloAsso CB
          </li>
        ) : null}
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
