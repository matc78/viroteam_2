import type { HomeKpi } from "@/lib/dashboard/mockHome";
import styles from "./KpiCard.module.css";

type KpiCardProps = {
  kpi: HomeKpi;
};

/** Tuile KPI bureau (membres, cotisations, aides). */
export function KpiCard({ kpi }: KpiCardProps) {
  return (
    <article className={`${styles.card} ${styles[kpi.tone]}`}>
      <p className={styles.label}>{kpi.label}</p>
      <p className={styles.value}>{kpi.value}</p>
      <p className={styles.hint}>{kpi.hint}</p>
    </article>
  );
}
