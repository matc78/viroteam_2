"use client";

import { FormEvent, useEffect, useState } from "react";
import { MemberRoles } from "@/lib/firebase/constants";
import {
  isMemberInviteValid,
  memberRoleLabel,
  type ClubMemberRole,
} from "@/lib/firebase/memberService";
import type { MemberRow } from "@/lib/members/membersView";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./MemberDetailPanel.module.css";

/** Props du panneau détail membre. */
type MemberDetailPanelProps = {
  member: MemberRow;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSaveLicense: (license: string) => Promise<void>;
  onChangeRole: (role: ClubMemberRole) => Promise<void>;
  onCopyInvite: () => void;
  onExtendInvite: () => Promise<void>;
  onRegenerateInvite: () => Promise<void>;
  onRemove: () => Promise<void>;
};

/** Fiche membre : licence, rôle, invitation, suppression. */
export function MemberDetailPanel({
  member,
  busy,
  error,
  onClose,
  onSaveLicense,
  onChangeRole,
  onCopyInvite,
  onExtendInvite,
  onRegenerateInvite,
  onRemove,
}: MemberDetailPanelProps) {
  const [license, setLicense] = useState(member.license);
  const [role, setRole] = useState<ClubMemberRole>(member.role);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setLicense(member.license);
    setRole(member.role);
    setConfirmRemove(false);
  }, [member.memberId, member.license, member.role]);

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function handleLicenseSubmit(event: FormEvent) {
    event.preventDefault();
    await onSaveLicense(license);
  }

  async function handleRoleSubmit(event: FormEvent) {
    event.preventDefault();
    if (role === member.role) return;
    await onChangeRole(role);
  }

  const showInviteActions = !member.hasLinkedAccount;
  const hasValidInvite = isMemberInviteValid(member);
  const inviteExpired =
    Boolean(member.pendingInviteCode) &&
    member.pendingInviteExpiresAt != null &&
    !hasValidInvite;

  return (
    <div
      className={`${dialogStyles.backdrop} ${styles.backdrop}`}
      role="presentation"
      onClick={requestClose}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") requestClose();
      }}
    >
      <aside
        className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
        data-tone="blue"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-detail-title"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>{memberRoleLabel(member.role)}</p>
            <h2 id="member-detail-title" className={dialogStyles.title}>
              {member.displayName}
            </h2>
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            onClick={requestClose}
            disabled={busy}
            aria-label="Fermer la fiche"
          >
            ×
          </button>
        </header>

        <dl className={styles.details}>
          <div>
            <dt>Inscription</dt>
            <dd>
              {member.hasLinkedAccount ? "Compte lié" : "Pas encore inscrit"}
            </dd>
          </div>
          {member.email ? (
            <div>
              <dt>Email</dt>
              <dd>{member.email}</dd>
            </div>
          ) : null}
          <div>
            <dt>Équipes</dt>
            <dd>
              {member.teamNames.length > 0
                ? member.teamNames.join(", ")
                : "Aucune"}
            </dd>
          </div>
          <div>
            <dt>Cotisation</dt>
            <dd>{member.feeStatusLabel}</dd>
          </div>
        </dl>

        {showInviteActions ? (
          <div className={dialogStyles.field}>
            <p className={dialogStyles.label}>Code invitation</p>
            {member.pendingInviteCode ? (
              <>
                <p className={styles.inviteCode}>
                  {member.pendingInviteCode}
                  {member.pendingInviteExpiresAt
                    ? ` · ${inviteExpired ? "expiré le" : "expire le"} ${member.pendingInviteExpiresAt.toLocaleDateString("fr-FR")}`
                    : ""}
                </p>
                <div className={styles.inviteActions}>
                  <button
                    type="button"
                    className={`${dialogStyles.buttonSecondary} ${styles.inviteAction}`}
                    disabled={busy}
                    onClick={() => void onExtendInvite()}
                  >
                    Prolonger
                  </button>
                  <button
                    type="button"
                    className={`${dialogStyles.buttonSecondary} ${styles.inviteAction}`}
                    disabled={busy}
                    onClick={() => void onRegenerateInvite()}
                  >
                    Nouveau code
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={dialogStyles.hint}>Aucune invitation active</p>
                <button
                  type="button"
                  className={dialogStyles.buttonSecondary}
                  disabled={busy}
                  onClick={() => void onRegenerateInvite()}
                >
                  Créer un code
                </button>
              </>
            )}
          </div>
        ) : null}

        <form className={dialogStyles.field} onSubmit={handleLicenseSubmit}>
          <label className={dialogStyles.label} htmlFor="member-license">
            Numéro de licence
          </label>
          <div className={styles.row}>
            <input
              id="member-license"
              className={styles.input}
              value={license}
              onChange={(event) => setLicense(event.target.value)}
              placeholder="Ex. LIC-12345"
              disabled={busy}
            />
            <button
              type="submit"
              className={`${dialogStyles.buttonSecondary} ${styles.rowAction}`}
              disabled={busy || license.trim() === member.license}
            >
              Enregistrer
            </button>
          </div>
        </form>

        <form className={dialogStyles.field} onSubmit={handleRoleSubmit}>
          <label className={dialogStyles.label} htmlFor="member-role">
            Rôle
          </label>
          <div className={styles.row}>
            <select
              id="member-role"
              className={styles.select}
              value={role}
              onChange={(event) =>
                setRole(event.target.value as ClubMemberRole)
              }
              disabled={busy}
            >
              <option value={MemberRoles.admin}>Admin</option>
              <option value={MemberRoles.coach}>Coach</option>
              <option value={MemberRoles.player}>Joueur</option>
            </select>
            <button
              type="submit"
              className={`${dialogStyles.buttonSecondary} ${styles.rowAction}`}
              disabled={busy || role === member.role}
            >
              Changer
            </button>
          </div>
        </form>

        <div className={styles.footerActions}>
          {showInviteActions ? (
            hasValidInvite ? (
              <button
                type="button"
                className={dialogStyles.button}
                onClick={onCopyInvite}
                disabled={busy}
              >
                Copier le message d&apos;invitation
              </button>
            ) : (
              <button
                type="button"
                className={dialogStyles.button}
                disabled={busy}
                onClick={() => void onRegenerateInvite()}
              >
                Générer nouveau code
              </button>
            )
          ) : null}

          {member.role !== MemberRoles.admin ? (
            confirmRemove ? (
              <>
                <p className={dialogStyles.hint}>
                  Confirmer la suppression de {member.displayName} ?
                </p>
                <button
                  type="button"
                  className={dialogStyles.buttonDanger}
                  disabled={busy}
                  onClick={() => void onRemove()}
                >
                  Confirmer la suppression
                </button>
                <button
                  type="button"
                  className={dialogStyles.buttonSecondary}
                  disabled={busy}
                  onClick={() => setConfirmRemove(false)}
                >
                  Annuler
                </button>
              </>
            ) : (
              <button
                type="button"
                className={dialogStyles.buttonDanger}
                disabled={busy}
                onClick={() => setConfirmRemove(true)}
              >
                Supprimer le membre
              </button>
            )
          ) : (
            <p className={dialogStyles.hint}>
              Un administrateur ne peut pas être supprimé depuis cette fiche.
            </p>
          )}
        </div>

        {error ? (
          <p className={dialogStyles.error} role="alert">
            {error}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
