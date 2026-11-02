"use client";

import { ReactNode, useId, useState } from "react";
import styles from "./settingsShared.module.css";

type SettingsAccordionProps = {
  title: string;
  description?: string;
  /** Valeur actuelle affichée à droite quand replié (ex. l’e-mail). */
  value?: string;
  /** Ouvert au chargement. */
  defaultOpen?: boolean;
  children: ReactNode;
};

/** Menu dépliant pour une rubrique des paramètres. */
export function SettingsAccordion({
  title,
  description,
  value,
  defaultOpen = false,
  children,
}: SettingsAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const headerId = useId();

  return (
    <div className={styles.accordion} data-open={open}>
      <button
        type="button"
        id={headerId}
        className={styles.accordionToggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.accordionTitleBlock}>
          <span className={styles.accordionTitle}>{title}</span>
          {description ? (
            <span className={styles.accordionDescription}>{description}</span>
          ) : null}
        </span>
        <span className={styles.accordionMeta}>
          {value && !open ? (
            <span className={styles.accordionValue}>{value}</span>
          ) : null}
          <span className={styles.chevron} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className={styles.accordionBody}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
