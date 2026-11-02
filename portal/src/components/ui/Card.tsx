import type { ReactNode } from "react";
import styles from "./Card.module.css";

/** Props de la carte de base de l’espace connecté. */
type CardProps = {
  children: ReactNode;
  className?: string;
  /** `none` : contenu bord à bord (listes de `ListRow`, tableaux). */
  padding?: "md" | "none";
  /** `highlight` : carte mise en avant (prochain événement, action à faire). */
  variant?: "default" | "highlight" | "attention";
  as?: "section" | "div" | "article";
  "aria-labelledby"?: string;
  "aria-label"?: string;
};

/**
 * Carte blanche à bordure neutre. La couleur est réservée aux statuts :
 * pas de bordure colorée par carte.
 */
export function Card({
  children,
  className,
  padding = "md",
  variant = "default",
  as: Tag = "section",
  ...aria
}: CardProps) {
  return (
    <Tag
      className={[styles.card, className].filter(Boolean).join(" ")}
      data-padding={padding}
      data-variant={variant}
      {...aria}
    >
      {children}
    </Tag>
  );
}

/** Props de l’en-tête de carte. */
type CardHeaderProps = {
  title: ReactNode;
  /** Id du titre (pour `aria-labelledby` de la carte). */
  titleId?: string;
  subtitle?: ReactNode;
  /** Élément à droite : lien « Voir tout », compteur, bouton. */
  action?: ReactNode;
  /** Niveau de titre (h2 par défaut). */
  level?: 2 | 3;
};

/** En-tête de carte : titre + sous-titre à gauche, action à droite. */
export function CardHeader({
  title,
  titleId,
  subtitle,
  action,
  level = 2,
}: CardHeaderProps) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <Heading id={titleId} className={styles.title}>
          {title}
        </Heading>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {action ? <div className={styles.headerAction}>{action}</div> : null}
    </header>
  );
}
