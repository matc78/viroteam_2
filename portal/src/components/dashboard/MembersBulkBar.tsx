"use client";

import { MemberFeeStatuses, MemberRoles } from "@/lib/firebase/constants";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./MembersBulkBar.module.css";

/** Props barre d’actions groupées membres. */
type MembersBulkBarProps = {
  selectedCount: number;
  busy: boolean;
  hasSeason: boolean;
  inviteableCount: number;
  onClear: () => void;
  onSendInvites: () => void;
  onSetFeeStatus: (status: string) => void;
  onSetRole: (role: string) => void;
  onExportSelected: () => void;
};

/**
 * Barre flottante pour actions en série sur la sélection membres.
 */
export function MembersBulkBar({
  selectedCount,
  busy,
  hasSeason,
  inviteableCount,
  onClear,
  onSendInvites,
  onSetFeeStatus,
  onSetRole,
  onExportSelected,
}: MembersBulkBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={styles.bar} role="region" aria-label="Actions groupées">
      <div className={styles.summary}>
        <strong>
          {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
        </strong>
        <button
          type="button"
          className={styles.linkButton}
          onClick={onClear}
          disabled={busy}
        >
          Tout désélectionner
        </button>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={onSendInvites}
          disabled={busy || inviteableCount === 0}
          title={
            inviteableCount === 0
              ? "Aucun membre sélectionné éligible à une invitation e-mail"
              : `Envoyer ${inviteableCount} invitation${inviteableCount > 1 ? "s" : ""} par e-mail`
          }
        >
          {busy
            ? "Envoi…"
            : `Envoyer mail invitations (${inviteableCount})`}
        </button>

        <label className={styles.selectField}>
          <span className={styles.selectLabel}>Cotisation</span>
          <PlanningSelect
            id="bulk-fee-status"
            value=""
            aria-label="Définir le statut cotisation"
            disabled={busy || !hasSeason}
            placement="up"
            options={[
              { value: "", label: hasSeason ? "Changer…" : "Pas de saison" },
              { value: MemberFeeStatuses.aPayer, label: "À payer" },
              { value: MemberFeeStatuses.exonere, label: "Exonéré" },
            ]}
            onChange={(next) => {
              if (!next) return;
              onSetFeeStatus(next);
            }}
          />
        </label>

        <label className={styles.selectField}>
          <span className={styles.selectLabel}>Rôle</span>
          <PlanningSelect
            id="bulk-role"
            value=""
            aria-label="Définir le rôle"
            disabled={busy}
            placement="up"
            options={[
              { value: "", label: "Changer…" },
              { value: MemberRoles.player, label: "Joueur" },
              { value: MemberRoles.coach, label: "Coach" },
              { value: MemberRoles.admin, label: "Admin" },
            ]}
            onChange={(next) => {
              if (!next) return;
              onSetRole(next);
            }}
          />
        </label>

        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={onExportSelected}
          disabled={busy}
        >
          Exporter
        </button>
      </div>
    </div>
  );
}
