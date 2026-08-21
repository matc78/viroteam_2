import styles from "./DashboardSkeleton.module.css";

type DashboardSkeletonVariant = "home" | "members" | "planning" | "fees";

type DashboardSkeletonProps = {
  variant: DashboardSkeletonVariant;
};

/** Placeholder de chargement aligné sur la structure de chaque module. */
export function DashboardSkeleton({ variant }: DashboardSkeletonProps) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className={styles.visuallyHidden}>Chargement…</span>
      {variant !== "planning" ? (
        <div className={styles.intro}>
          <div className={`${styles.bone} ${styles.eyebrow}`} />
          <div className={`${styles.bone} ${styles.heading}`} />
          <div className={`${styles.bone} ${styles.lead}`} />
        </div>
      ) : null}

      {variant === "home" ? (
        <>
          <div className={styles.kpiGrid}>
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={`${styles.bone} ${styles.kpiCard}`} />
            ))}
          </div>
          <div className={styles.activityGrid}>
            <div className={`${styles.bone} ${styles.activityMain}`} />
            <div className={`${styles.bone} ${styles.activitySide}`} />
          </div>
          <div className={styles.chartsGrid}>
            <div className={`${styles.bone} ${styles.chartCard}`} />
            <div className={`${styles.bone} ${styles.chartCard}`} />
          </div>
        </>
      ) : null}

      {variant === "members" ? (
        <>
          <div className={styles.toolbar}>
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={`${styles.bone} ${styles.toolbarChip}`} />
            ))}
          </div>
          <div className={styles.table}>
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className={`${styles.bone} ${styles.tableRow}`} />
            ))}
          </div>
        </>
      ) : null}

      {variant === "fees" ? (
        <div className={styles.form}>
          <div className={`${styles.bone} ${styles.formBlock}`} />
          <div className={`${styles.bone} ${styles.formBlock}`} />
          <div className={`${styles.bone} ${styles.formBlock}`} />
        </div>
      ) : null}

      {variant === "planning" ? (
        <div className={styles.planningLayout}>
          <div className={`${styles.bone} ${styles.sidebar}`} />
          <div className={`${styles.bone} ${styles.calendar}`} />
        </div>
      ) : null}
    </div>
  );
}
