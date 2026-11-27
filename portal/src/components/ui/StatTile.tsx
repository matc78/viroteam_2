import Link from "next/link";
import type { ReactNode } from "react";
import type { StatusTone } from "./StatusBadge";
import styles from "./StatTile.module.css";

/** Props d’une tuile de chiffre clé. */
type StatTileProps = {
  label: string;
  value: ReactNode;
  /** Unité affichée en plus petit après la valeur (ex. « % »). */
  unit?: string;
  /** Contexte sous la valeur (période, base de calcul). */
  hint?: ReactNode;
  /** Colore la valeur et une barre latérale fine quand le chiffre demande une action. */
  tone?: StatusTone;
  /** Tuile cliquable vers la page détaillée. */
  href?: string;
  /**
   * Tuile cliquable sans navigation (filtre ou défile vers l’action à
   * mener). Ignoré si `href`.
   */
  onClick?: () => void;
};

/** Tuile de KPI : libellé, valeur en gros, contexte. */
export function StatTile({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  href,
  onClick,
}: StatTileProps) {
  const content = (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {value}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${styles.tile} ${styles.link}`} data-tone={tone}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        className={`${styles.tile} ${styles.link} ${styles.button}`}
        data-tone={tone}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={styles.tile} data-tone={tone}>
      {content}
    </div>
  );
}

/** Grille responsive de tuiles (2 à 4 colonnes selon la largeur). */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
