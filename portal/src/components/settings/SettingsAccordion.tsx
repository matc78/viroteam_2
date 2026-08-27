"use client";

import { ReactNode, useId, useState } from "react";
import styles from "./settingsShared.module.css";

type SettingsAccordionProps = {
  title: string;
  description?: string;
  /** Ouvert au chargement. */
  defaultOpen?: boolean;
  children: ReactNode;
  /** Variante visuelle (danger pour suppression). */
  tone?: "default" | "danger";
};

/** Menu dépliant pour une rubrique des paramètres. */
export function SettingsAccordion({
  title,
  description,
  defaultOpen = false,
  children,
  tone = "default",
}: SettingsAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const headerId = useId();

  return (
    <div
      className={`${styles.accordion}${tone === "danger" ? ` ${styles.accordionDanger}` : ""}`}
    >
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
        <span className={styles.chevron} aria-hidden="true">
          ▸
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
