"use client";

import { FormEvent, useState } from "react";
import { MemberRoles } from "@/lib/firebase/constants";
import type { AddMemberResult } from "@/lib/firebase/memberService";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import { PlanningSelect } from "./PlanningSelect";
import { InviteEmailButton } from "./InviteEmailButton";
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
    email: string;
    role: typeof MemberRoles.player | typeof MemberRoles.coach;
  }) => Promise<void>;
  onCopyInvite: () => void;
  onEmailInvite: () => Promise<boolean>;
};

/** Dialog ajout membre (prénom / nom / e-mail optionnel / rôle joueur|coach). */
export function AddMemberDialog({
  busy,
  error,
  created,
  onClose,
  onSubmit,
  onCopyInvite,
  onEmailInvite,
}: AddMemberDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<
    typeof MemberRoles.player | typeof MemberRoles.coach
  >(MemberRoles.player);

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({ firstName, lastName, email, role });
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
            <div
              className={`${dialogStyles.actions} ${styles.successActions}`}
            >
              {created.member.email ? (
                <InviteEmailButton
                  onSend={onEmailInvite}
                  disabled={busy}
                />
              ) : null}
              <button
                type="button"
                className={
                  created.member.email
                    ? dialogStyles.buttonSecondary
                    : dialogStyles.button
                }
                onClick={onCopyInvite}
              >
                Copier le message
              </button>
              <button
                type="button"
                className={dialogStyles.buttonDanger}
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
              <span className={dialogStyles.label}>
                E-mail <span className={styles.optional}>(optionnel)</span>
              </span>
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                autoComplete="off"
                placeholder="pour préremplir l’invitation"
              />
            </label>
            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Rôle</span>
              <PlanningSelect
                id="add-member-role"
                value={role}
                disabled={busy}
                options={[
                  { value: MemberRoles.player, label: "Joueur" },
                  { value: MemberRoles.coach, label: "Coach" },
                ]}
                onChange={(next) =>
                  setRole(
                    next as
                      | typeof MemberRoles.player
                      | typeof MemberRoles.coach,
                  )
                }
              />
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
