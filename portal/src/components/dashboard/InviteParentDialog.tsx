"use client";

import { FormEvent, useState } from "react";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./AddMemberDialog.module.css";

/** Dialog : choisir un enfant sans parent + e-mail. */
type InviteParentDialogProps = {
  busy: boolean;
  error: string | null;
  candidates: ClubMemberRecord[];
  onClose: () => void;
  onSubmit: (input: { memberId: string; email: string }) => Promise<void>;
};

/** Dialog invitation parent depuis l’onglet Parents. */
export function InviteParentDialog({
  busy,
  error,
  candidates,
  onClose,
  onSubmit,
}: InviteParentDialogProps) {
  const [memberId, setMemberId] = useState(candidates[0]?.memberId ?? "");
  const [email, setEmail] = useState("");

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!memberId || !email.trim()) return;
    await onSubmit({ memberId, email: email.trim() });
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
      <FadeScrollArea
        className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
        viewportClassName={`${dialogStyles.body} ${styles.panelContent}`}
        data-tone="green"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-parent-title"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>Parents</p>
            <h2 id="invite-parent-title" className={dialogStyles.title}>
              Inviter un parent
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

        {candidates.length === 0 ? (
          <p className={dialogStyles.hint}>
            Aucun joueur sans parent à inviter.
          </p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Enfant</span>
              <PlanningSelect
                id="invite-parent-child"
                value={memberId}
                disabled={busy}
                required
                options={candidates.map((member) => ({
                  value: member.memberId,
                  label:
                    member.displayName ||
                    `${member.firstName} ${member.lastName}`.trim(),
                }))}
                onChange={setMemberId}
              />
            </label>
            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>E-mail du parent</span>
              <input
                className={styles.input}
                type="email"
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="parent@email.com"
                required
              />
            </label>
            {error ? (
              <p className={dialogStyles.error} role="alert">
                {error}
              </p>
            ) : (
              <p className={dialogStyles.hint}>
                Un parent par enfant. Il pourra voir le planning, répondre et
                payer la cotisation.
              </p>
            )}
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.buttonSecondary}
                disabled={busy}
                onClick={requestClose}
              >
                Annuler
              </button>
              <button
                type="submit"
                className={dialogStyles.button}
                disabled={busy || !memberId}
              >
                Inviter
              </button>
            </div>
          </form>
        )}
      </FadeScrollArea>
    </div>
  );
}
