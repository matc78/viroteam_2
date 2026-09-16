"use client";

import { useState } from "react";
import styles from "./CreatePollSheet.module.css";

type CreatePollSheetProps = {
  onClose: () => void;
  onSubmit: (payload: {
    question: string;
    options: string[];
    allowMultiple: boolean;
  }) => Promise<void>;
};

/** Formulaire création de sondage chat. */
export function CreatePollSheet({ onClose, onSubmit }: CreatePollSheetProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || trimmedOptions.length < 2) {
      setError("Ajoute au moins 2 options.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        question: question.trim(),
        options: trimmedOptions,
        allowMultiple,
      });
    } catch {
      setError("Impossible de créer le sondage.");
      setBusy(false);
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <header className={styles.header}>
          <h3 className={styles.title}>Sondage</h3>
          <button
            type="button"
            className={styles.close}
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <label className={styles.label}>
          Question
          <input
            className={styles.input}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex. Qui amène les ballons ?"
          />
        </label>
        {options.map((option, index) => (
          <label key={index} className={styles.label}>
            Option {index + 1}
            <input
              className={styles.input}
              value={option}
              onChange={(e) => {
                const next = [...options];
                next[index] = e.target.value;
                setOptions(next);
              }}
            />
          </label>
        ))}
        {options.length < 12 ? (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setOptions([...options, ""])}
          >
            Ajouter une option
          </button>
        ) : null}
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
          />
          Plusieurs réponses possibles
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => void handleSubmit()}
        >
          Envoyer le sondage
        </button>
      </div>
    </div>
  );
}
