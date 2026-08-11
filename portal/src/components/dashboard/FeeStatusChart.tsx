import type { FeeStatusSegment } from "@/lib/dashboard/mockHome";
import styles from "./FeeStatusChart.module.css";

type FeeStatusChartProps = {
  segments: FeeStatusSegment[];
};

const RADIUS = 42;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Donut SVG : répartition payé / partiel / à payer. */
export function FeeStatusChart({ segments }: FeeStatusChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  let offset = 0;

  return (
    <section className={styles.panel} aria-labelledby="fee-status-title">
      <header className={styles.header}>
        <h2 id="fee-status-title" className={styles.title}>
          Cotisations
        </h2>
        <p className={styles.subtitle}>Répartition saison en cours</p>
      </header>

      <div className={styles.body}>
        <div className={styles.chartWrap}>
          <svg
            className={styles.chart}
            viewBox="0 0 120 120"
            role="img"
            aria-label={`Cotisations : ${total} dossiers`}
          >
            <circle
              className={styles.track}
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
            />
            {segments.map((segment) => {
              const length =
                total === 0 ? 0 : (segment.count / total) * CIRCUMFERENCE;
              const dashOffset = -offset;
              offset += length;
              return (
                <circle
                  key={segment.status}
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  transform="rotate(-90 60 60)"
                />
              );
            })}
          </svg>
          <div className={styles.center}>
            <span className={styles.centerValue}>{total}</span>
            <span className={styles.centerLabel}>dossiers</span>
          </div>
        </div>

        <ul className={styles.legend}>
          {segments.map((segment) => (
            <li key={segment.status} className={styles.legendItem}>
              <span
                className={styles.swatch}
                style={{ background: segment.color }}
                aria-hidden="true"
              />
              <span className={styles.legendLabel}>{segment.label}</span>
              <span className={styles.legendCount}>{segment.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
