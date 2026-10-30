"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./LandingTabs.module.css";

export type LandingTab = {
  key: string;
  label: ReactNode;
  /** Libellé accessible si `label` n'est pas du texte seul. */
  ariaLabel?: string;
  content: ReactNode;
};

export type LandingTabsProps = {
  tabs: readonly LandingTab[];
  /** Nom de la liste d'onglets pour les lecteurs d'écran. */
  ariaLabel: string;
  /** Couleur d'accent de l'onglet actif (variable CSS ou couleur). */
  accent?: string;
  className?: string;
};

/**
 * Onglets accessibles (flèches, Début / Fin) ; tous les panneaux restent dans
 * le DOM (`hidden`) pour l'indexation.
 */
export function LandingTabs({
  tabs,
  ariaLabel,
  accent = "var(--color-primary-800)",
  className,
}: LandingTabsProps) {
  const baseId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setActiveIndex(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: activeIndex + 1,
      ArrowLeft: activeIndex - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    focusTab(moves[event.key]);
  };

  return (
    <div
      className={`${styles.tabs} ${className ?? ""}`.trim()}
      style={{ ["--tabs-accent" as string]: accent }}
    >
      <div role="tablist" aria-label={ariaLabel} className={styles.list}>
        {tabs.map((tab, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={tab.key}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.key}`}
              aria-label={tab.ariaLabel}
              tabIndex={selected ? 0 : -1}
              className={`${styles.tab} ${selected ? styles.tabActive : ""}`.trim()}
              onClick={() => setActiveIndex(index)}
              onKeyDown={onKeyDown}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${baseId}-panel-${tab.key}`}
          aria-labelledby={`${baseId}-tab-${tab.key}`}
          hidden={index !== activeIndex}
          className={styles.panel}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
