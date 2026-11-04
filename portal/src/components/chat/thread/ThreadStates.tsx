"use client";

import styles from "../ChatThreadView.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

/** Alternance des bulles fantômes (côté, largeur relative). */
const SKELETON_ROWS: { mine: boolean; width: string }[] = [
  { mine: false, width: "58%" },
  { mine: false, width: "36%" },
  { mine: true, width: "48%" },
  { mine: false, width: "64%" },
  { mine: true, width: "30%" },
  { mine: true, width: "52%" },
];

/** Squelette du fil pendant le premier chargement (pas d’écran vide). */
export function ThreadSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-busy="true">
      <span className="sr-only">{chatCopy.loading}</span>
      {SKELETON_ROWS.map((row, index) => (
        <span
          key={index}
          className={`${styles.skeletonBubble}${row.mine ? ` ${styles.skeletonBubbleMine}` : ""}`}
          style={{ width: row.width }}
          aria-hidden
        />
      ))}
    </div>
  );
}

/** Erreur de chargement du fil, avec relance. */
export function ThreadLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.threadState} role="alert">
      <p className={styles.threadStateTitle}>{chatCopy.threadLoadFailed}</p>
      <button type="button" className={styles.threadStateBtn} onClick={onRetry}>
        {chatCopy.retry}
      </button>
    </div>
  );
}

/** Fil sans message : invite à écrire si l’utilisateur le peut. */
export function ThreadEmpty({ canWrite }: { canWrite: boolean }) {
  return (
    <div className={styles.threadState}>
      <p className={styles.threadStateTitle}>{chatCopy.emptyThread}</p>
      {canWrite ? (
        <p className={styles.threadStateHint}>{chatCopy.emptyThreadHint}</p>
      ) : null}
    </div>
  );
}
