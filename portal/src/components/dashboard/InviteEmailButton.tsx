"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import styles from "./InviteEmailButton.module.css";

type InviteEmailFeedback = "idle" | "loading" | "success" | "error";

type InviteEmailButtonProps = {
  /** Envoie l’invitation ; true = succès. */
  onSend: () => Promise<boolean>;
  disabled?: boolean;
  /** Style visuel selon le contexte. */
  variant?: "primary" | "ghost";
  className?: string;
  /** Empêche le clic de sélectionner la ligne (tableau). */
  stopPropagation?: boolean;
};

const SUCCESS_MS = 5000;
const ERROR_MS = 2000;

/**
 * Bouton d’envoi d’invitation e-mail avec feedback :
 * loader → check vert 5 s (anti double-clic) / croix rouge 2 s si échec.
 */
export function InviteEmailButton({
  onSend,
  disabled = false,
  variant = "primary",
  className,
  stopPropagation = false,
}: InviteEmailButtonProps) {
  const [feedback, setFeedback] = useState<InviteEmailFeedback>("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  function scheduleReset(nextIdleAfterMs: number) {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setFeedback("idle");
      resetTimerRef.current = null;
    }, nextIdleAfterMs);
  }

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (stopPropagation) event.stopPropagation();
    if (disabled || feedback !== "idle") return;

    setFeedback("loading");
    try {
      const ok = await onSend();
      if (ok) {
        setFeedback("success");
        scheduleReset(SUCCESS_MS);
      } else {
        setFeedback("error");
        scheduleReset(ERROR_MS);
      }
    } catch {
      setFeedback("error");
      scheduleReset(ERROR_MS);
    }
  }

  const idleLabel =
    variant === "ghost" ? "Envoyer" : "Envoyer l’invitation";
  const isLocked = feedback !== "idle";
  const label =
    feedback === "loading"
      ? "Envoi…"
      : feedback === "success"
        ? "Envoyée"
        : feedback === "error"
          ? "Échec"
          : idleLabel;

  return (
    <button
      type="button"
      className={[
        styles.button,
        variant === "ghost" ? styles.ghost : styles.primary,
        feedback === "success" ? styles.success : "",
        feedback === "error" ? styles.error : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => void handleClick(event)}
      disabled={disabled || isLocked}
      aria-busy={feedback === "loading"}
      aria-label={
        feedback === "idle" ? "Envoyer l’invitation" : label
      }
      title={feedback === "idle" ? undefined : label}
    >
      <span className={styles.content} data-feedback={feedback}>
        {feedback === "loading" ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : null}
        {feedback === "success" ? (
          <span className={styles.check} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path
                d="M5 12.5 10 17.5 19 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : null}
        {feedback === "error" ? (
          <span className={styles.cross} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path
                d="M7 7 17 17M17 7 7 17"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        ) : null}
        <span className={styles.label}>{label}</span>
      </span>
    </button>
  );
}
