"use client";

import { useState } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import infoStyles from "./ConversationInfoPanel.module.css";
import styles from "./CreatePollSheet.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type CreatePollSheetProps = {
  onClose: () => void;
  onSubmit: (payload: {
    question: string;
    options: string[];
    allowMultiple: boolean;
  }) => Promise<void>;
};

/** Panneau création de sondage (même slot / largeur que infos groupe). */
export function CreatePollSheet({ onClose, onSubmit }: CreatePollSheetProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || trimmedOptions.length < 2) {
      setError(chatCopy.pollNeedOptions);
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
      setError(chatCopy.pollFailed);
      setBusy(false);
    }
  }

  return (
    <aside className={infoStyles.panel} aria-label={chatCopy.createPollLabel}>
      <header className={infoStyles.header}>
        <button
          type="button"
          className={infoStyles.headerIconBtn}
          aria-label={chatCopy.close}
          onClick={onClose}
        >
          <ChatIcon name="close" size={20} />
        </button>
        <h2 className={infoStyles.headerTitle}>{chatCopy.pollLabel}</h2>
      </header>

      <div className={`${infoStyles.scrollBody} ${styles.form}`}>
        <label className={styles.label}>
          {chatCopy.pollQuestionLabel}
          <input
            className={styles.input}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={chatCopy.pollQuestionHint}
          />
        </label>
        {options.map((option, index) => (
          <label key={index} className={styles.label}>
            {chatCopy.pollOptionLabel(index + 1)}
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
            {chatCopy.pollAddOption}
          </button>
        ) : null}
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
          />
          {chatCopy.pollAllowMultiple}
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => void handleSubmit()}
        >
          {busy ? chatCopy.pollSending : chatCopy.pollSend}
        </button>
      </div>
    </aside>
  );
}
