import type { ReactNode } from "react";
import styles from "./DashboardPageIntro.module.css";

/** Props de l'en-tete des pages dashboard. */
type DashboardPageIntroProps = {
  eyebrow: string;
  heading: string;
  lead: ReactNode;
  /** Recharge manuelle des données Firestore de la page. */
  onRefresh?: () => void;
  refreshing?: boolean;
};

/** En-tête partagé des pages dashboard (home, cotisations, …). */
export function DashboardPageIntro({
  eyebrow,
  heading,
  lead,
  onRefresh,
  refreshing = false,
}: DashboardPageIntroProps) {
  return (
    <header className={styles.intro}>
      <div className={styles.introMain}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.heading}>{heading}</h1>
          <p className={styles.lead}>{lead}</p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            className={styles.refreshButton}
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label="Recharger la page"
          >
            {refreshing ? "Actualisation…" : "Actualiser"}
          </button>
        ) : null}
      </div>
    </header>
  );
}
