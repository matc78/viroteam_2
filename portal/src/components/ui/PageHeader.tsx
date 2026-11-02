import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

/** Props de l’en-tête de page. */
type PageHeaderProps = {
  title: ReactNode;
  /** Petite ligne au-dessus du titre (nom du club, période). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Actions principales de la page, alignées à droite. */
  actions?: ReactNode;
  /** Contenu sous le titre (sélecteur d’audience, filtres). */
  children?: ReactNode;
};

/** En-tête de page de l’espace connecté : titre, contexte, actions. */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <header className={styles.root}>
      <div className={styles.row}>
        <div className={styles.text}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1 className={styles.title}>{title}</h1>
          {description ? (
            <p className={styles.description}>{description}</p>
          ) : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
