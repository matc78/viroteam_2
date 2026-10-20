"use client";

import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { sessionCopy } from "@/lib/copy/sessionCopy";
import formStyles from "./AuthForm.module.css";
import styles from "./SessionErrorState.module.css";

type SessionErrorStateProps = {
  onRetry: () => void;
  onLogout: () => Promise<void>;
};

/**
 * Écran plein écran quand la session Firebase est valide mais que le profil
 * ou les clubs n’ont pas pu être chargés (remplace un loader sans fin).
 */
export function SessionErrorState({ onRetry, onLogout }: SessionErrorStateProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className={styles.screen} role="alert" aria-live="assertive">
      <div className={styles.card}>
        <BrandMark size={48} />
        <h1 className={styles.title}>{sessionCopy.errorTitle}</h1>
        <p className={styles.lead}>{sessionCopy.errorLead}</p>
        <button
          type="button"
          className={formStyles.submit}
          onClick={onRetry}
          disabled={loggingOut}
        >
          {sessionCopy.retry}
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => void handleLogout()}
          disabled={loggingOut}
        >
          {loggingOut ? sessionCopy.loggingOut : sessionCopy.logout}
        </button>
      </div>
    </div>
  );
}
