import type { ReactNode } from "react";
import styles from "./StatusBadge.module.css";

/** Tonalité d’un statut (seul usage de la couleur dans l’espace connecté). */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

/** Props du badge de statut. */
type StatusBadgeProps = {
  tone?: StatusTone;
  children: ReactNode;
  /** Pastille de couleur avant le texte. */
  dot?: boolean;
  className?: string;
};

/** Badge compact : « Payé », « À payer », « En retard », compteurs. */
export function StatusBadge({
  tone = "neutral",
  children,
  dot = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={[styles.badge, className].filter(Boolean).join(" ")}
      data-tone={tone}
    >
      {dot ? <span className={styles.dot} aria-hidden /> : null}
      {children}
    </span>
  );
}
