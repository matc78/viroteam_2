import type { ReactNode } from "react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import styles from "./AuthShell.module.css";

type AuthShellProps = {
  /** Accent de bordure du panneau. */
  accent?: "cyan" | "orange";
  /** Eyebrow uppercase au-dessus du titre. */
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
};

/** Coquille auth : header, formes décoratives, panneau centré, footer. */
export function AuthShell({
  accent = "cyan",
  eyebrow,
  title,
  lead,
  children,
}: AuthShellProps) {
  const panelClass =
    accent === "orange"
      ? `${styles.panel} ${styles.panelOrange}`
      : `${styles.panel} ${styles.panelCyan}`;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={panelClass}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
