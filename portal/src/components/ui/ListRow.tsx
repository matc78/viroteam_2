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
  className?: string;
};

/**
 * Ligne de liste dense, à empiler dans `ListRows` (séparateurs automatiques).
 * Rendue en lien si `href` est fourni.
 */
export function ListRow({
  title,
  meta,
  leading,
  trailing,
  footer,
  href,
  className,
}: ListRowProps) {
  const body = (
    <>
      <div className={styles.main}>
        {leading ? <div className={styles.leading}>{leading}</div> : null}
        <div className={styles.text}>
          <span className={styles.title}>{title}</span>
          {meta ? <span className={styles.meta}>{meta}</span> : null}
        </div>
        {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      </div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </>
  );

  const rowClass = [styles.row, href ? styles.rowLink : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={rowClass}>
      {href ? (
        <Link href={href} className={styles.linkFill}>
          {body}
        </Link>
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
