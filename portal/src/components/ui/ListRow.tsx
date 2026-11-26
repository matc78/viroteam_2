import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./ListRow.module.css";

/** Props d’une ligne de liste. */
type ListRowProps = {
  title: ReactNode;
  /** Ligne secondaire : date, lieu, équipe… */
  meta?: ReactNode;
  /** Icône, avatar ou bloc date à gauche. */
  leading?: ReactNode;
  /** Badge, bouton ou chiffre à droite. */
  trailing?: ReactNode;
  /** Contenu pleine largeur sous la ligne (boutons RSVP, barre de réponses). */
  footer?: ReactNode;
  /** Ligne cliquable vers une page. */
  href?: string;
  /** Ligne cliquable sans navigation (ouvre un panneau). Ignoré si `href`. */
  onClick?: () => void;
  /**
   * Ligne sélectionnée (panneau ouvert sur cet élément) : annoncée par
   * `aria-expanded` sur le bouton. Contenu en `span` (valide dans un bouton).
   */
  selected?: boolean;
  className?: string;
};

/**
 * Ligne de liste dense, à empiler dans `ListRows` (séparateurs automatiques).
 * Rendue en lien si `href` est fourni, en bouton si `onClick` est fourni.
 */
export function ListRow({
  title,
  meta,
  leading,
  trailing,
  footer,
  href,
  onClick,
  selected = false,
  className,
}: ListRowProps) {
  const body = (
    <>
      <span className={styles.main}>
        {leading ? <span className={styles.leading}>{leading}</span> : null}
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          {meta ? <span className={styles.meta}>{meta}</span> : null}
        </span>
        {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
      </span>
      {footer ? <span className={styles.footer}>{footer}</span> : null}
    </>
  );

  const interactive = Boolean(href || onClick);
  const rowClass = [styles.row, interactive ? styles.rowLink : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={rowClass} data-selected={selected ? "true" : undefined}>
      {href ? (
        <Link href={href} className={styles.linkFill}>
          {body}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          className={`${styles.linkFill} ${styles.buttonFill}`}
          aria-expanded={selected}
          onClick={onClick}
        >
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  );
}

/** Conteneur de `ListRow` (liste sémantique, séparateurs). */
export function ListRows({
  children,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <ul className={styles.list} aria-label={ariaLabel}>
      {children}
    </ul>
  );
}
