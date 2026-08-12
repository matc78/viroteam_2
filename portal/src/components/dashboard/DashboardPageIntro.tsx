import type { ReactNode } from "react";
import styles from "./DashboardPageIntro.module.css";

/** Props de l'en-tete des pages dashboard. */
type DashboardPageIntroProps = {
  eyebrow: string;
  heading: string;
  lead: ReactNode;
};

/** En-tête partagé des pages dashboard (home, cotisations, …). */
export function DashboardPageIntro({
  eyebrow,
  heading,
  lead,
}: DashboardPageIntroProps) {
  return (
    <header className={styles.intro}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.lead}>{lead}</p>
      </div>
    </header>
  );
}
