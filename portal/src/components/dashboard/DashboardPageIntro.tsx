import type { CSSProperties, ReactNode } from "react";
import styles from "./DashboardPageIntro.module.css";

/** Props de l'en-tete des pages dashboard. */
type DashboardPageIntroProps = {
  eyebrow: string;
  heading: string;
  lead?: ReactNode;
  /** Contenu inséré entre le heading et le bouton Actualiser. */
  children?: ReactNode;
  /** Recharge manuelle des données Firestore de la page. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Affiche une pastille « ! » sur le bouton Actualiser. */
  hasNewData?: boolean;
  /** Couleur d'accentuation du bouton quand hasNewData est true (hex du club). */
  accentColor?: string;
};

/** En-tête partagé des pages dashboard (home, cotisations, …). */
export function DashboardPageIntro({
  eyebrow,
  heading,
  lead,
  children,
  onRefresh,
  refreshing = false,
  hasNewData = false,
  accentColor,
}: DashboardPageIntroProps) {
  const buttonStyle: CSSProperties | undefined =
    hasNewData && accentColor
      ? ({ "--refresh-accent": accentColor } as CSSProperties)
      : undefined;

  return (
    <header className={styles.intro}>
      <div className={styles.introMain}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.heading}>{heading}</h1>
          {lead ? <p className={styles.lead}>{lead}</p> : null}
        </div>
        {children}
        {onRefresh ? (
          <button
            type="button"
            className={`${styles.refreshButton}${hasNewData ? ` ${styles.refreshHighlight}` : ""}`}
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label="Recharger la page"
            style={buttonStyle}
          >
            {refreshing ? "Actualisation…" : "Actualiser"}
            {hasNewData && !refreshing ? (
              <span className={styles.refreshBadge} aria-label="Nouvelles données disponibles">!</span>
            ) : null}
          </button>
        ) : null}
      </div>
    </header>
  );
}
