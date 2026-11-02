import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

/** Props de l’état vide. */
type EmptyStateProps = {
  children: ReactNode;
  /** Titre (variante bloc uniquement). */
  title?: ReactNode;
  /** Action proposée (lien, bouton). */
  action?: ReactNode;
  /** `inline` : une ligne discrète ; `block` : bloc centré pour une page vide. */
  variant?: "inline" | "block";
};

/** État vide unique de l’espace connecté. */
export function EmptyState({
  children,
  title,
  action,
  variant = "inline",
}: EmptyStateProps) {
  return (
    <div className={styles.root} data-variant={variant}>
      {title ? <p className={styles.title}>{title}</p> : null}
      <p className={styles.text}>{children}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
