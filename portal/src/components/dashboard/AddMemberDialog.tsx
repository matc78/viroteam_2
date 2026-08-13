"use client";

import { FormEvent, useState } from "react";
import { MemberRoles } from "@/lib/firebase/constants";
import type { AddMemberResult } from "@/lib/firebase/memberService";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./AddMemberDialog.module.css";

/** Props du dialog d’ajout membre. */
type AddMemberDialogProps = {
  busy: boolean;
  error: string | null;
  created: AddMemberResult | null;
  onClose: () => void;
  onSubmit: (input: {
    firstName: string;
    lastName: string;
    role: typeof MemberRoles.player | typeof MemberRoles.coach;
  }) => Promise<void>;
  onCopyInvite: () => void;
};

/** Dialog ajout membre (prénom / nom / rôle joueur|coach). */
export function AddMemberDialog({
  busy,
  error,
  created,
  onClose,
  onSubmit,
  onCopyInvite,
}: AddMemberDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<
    typeof MemberRoles.player | typeof MemberRoles.coach
  >(MemberRoles.player);

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({ firstName, lastName, role });
  }

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onClick={requestClose}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") requestClose();
      }}
    >
      <div
        className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
        data-tone="green"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>Membres</p>
            <h2 id="add-member-title" className={dialogStyles.title}>
              {created ? "Invitation créée" : "Ajouter un membre"}
            </h2>
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            onClick={requestClose}
            disabled={busy}
            aria-label="Fermer"
          >
            ×
          </button>
        </header>

        {created ? (
          <div className={styles.success}>
            <p className={dialogStyles.hint}>
              {created.member.displayName} a été ajouté·e. Partagez ce code :
            </p>
            <p className={styles.code}>{created.invitation.code}</p>
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.button}
                onClick={onCopyInvite}
              >
                Copier le message
              </button>
              <button
                type="button"
                className={dialogStyles.buttonSecondary}
                onClick={requestClose}
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <form
            className={styles.form}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Prénom</span>
              <input
                className={styles.input}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                disabled={busy}
                autoComplete="off"
              />
            </label>
            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Nom</span>
              <input
                className={styles.input}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                disabled={busy}
                autoComplete="off"
              />
            </label>
            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Rôle</span>
              <select
                className={styles.select}
                value={role}
                onChange={(event) =>
                  setRole(
                    event.target.value as
                      | typeof MemberRoles.player
                      | typeof MemberRoles.coach,
                  )
                }
                disabled={busy}
              >
                <option value={MemberRoles.player}>Joueur</option>
                <option value={MemberRoles.coach}>Coach</option>
              </select>
            </label>

            {error ? (
              <p className={dialogStyles.error} role="alert">
                {error}
              </p>
            ) : null}

            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.buttonSecondary}
                onClick={requestClose}
                disabled={busy}
              >
                Annuler
              </button>
              <button
                type="submit"
                className={dialogStyles.button}
                disabled={busy}
              >
                {busy ? "Création…" : "Créer et inviter"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
