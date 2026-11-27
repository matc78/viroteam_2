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
  /**
   * Badge cliquable (rendu en bouton) : mène à l’action que le statut
   * réclame (« Sans coach » → ajouter un coach, « 3 à relancer » → la liste).
   */
  onClick?: () => void;
  /**
   * Libellé accessible du bouton quand le texte seul ne dit pas l’action ;
   * commence par le texte visible (« Sans coach : ajouter un coach »).
   */
  actionLabel?: string;
};

/**
 * Badge compact : « Payé », « À payer », « En retard », compteurs. Un statut
 * qui demande une action (« à compléter », « à relancer »…) reçoit `onClick`.
 */
export function StatusBadge({
  tone = "neutral",
  children,
  dot = false,
  className,
  onClick,
  actionLabel,
}: StatusBadgeProps) {
  const classes = [styles.badge, onClick ? styles.action : "", className]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      {dot ? <span className={styles.dot} aria-hidden /> : null}
      {children}
      {onClick ? (
        <span className={styles.chevron} aria-hidden>
          ›
        </span>
      ) : null}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        data-tone={tone}
        aria-label={actionLabel}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={classes} data-tone={tone}>
      {content}
    </span>
  );
}
