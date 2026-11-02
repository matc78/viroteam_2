"use client";

import { FormEvent, useId, useState } from "react";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import dialogStyles from "@/components/dashboard/DashboardDialog.module.css";
import shared from "@/components/settings/settingsShared.module.css";

type DeleteAccountDialogProps = {
  /** Compte e-mail / mot de passe : ré-authentification par mot de passe. */
  passwordAccount: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  /** Lance la suppression ; `currentPassword` absent pour un compte Google. */
  onConfirm: (currentPassword: string | undefined) => Promise<void>;
};

/** Confirmation de suppression définitive du compte (case + mot de passe). */
export function DeleteAccountDialog({
  passwordAccount,
  busy,
  error,
  onClose,
  onConfirm,
}: DeleteAccountDialogProps) {
  const titleId = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");

  function requestClose() {
    if (busy) return;
    onClose();
  }

  const dialogRef = useDialogA11y({ onClose: requestClose });
  const canSubmit =
    confirmed && !busy && (!passwordAccount || password.length > 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    await onConfirm(passwordAccount ? password : undefined);
  }

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`${panelStyles.panel} ${dialogStyles.panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>Compte</p>
            <h2 id={titleId} className={dialogStyles.title}>
              Supprimer ton compte
            </h2>
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            disabled={busy}
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className={dialogStyles.body}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <p className={shared.dangerNotice}>
            Action définitive. Ton compte sera supprimé et tes fiches membre
            anonymisées (« Membre supprimé »). L’historique des clubs est
            conservé, tes invitations en attente sont révoquées.
          </p>
          <label className={shared.checkRow}>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>Je confirme vouloir supprimer mon compte</span>
          </label>
          {passwordAccount ? (
            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Mot de passe actuel</span>
              <input
                className={shared.input}
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={busy || !confirmed}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          ) : (
            <p className={dialogStyles.hint}>
              Une fenêtre Google ou Apple s’ouvrira pour confirmer la
              suppression.
            </p>
          )}
          {error ? (
            <p className={dialogStyles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={dialogStyles.actions}>
            <button
              type="button"
              className={dialogStyles.buttonSecondary}
              disabled={busy}
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={dialogStyles.buttonDanger}
              disabled={!canSubmit}
            >
              {busy ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
