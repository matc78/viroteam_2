"use client";

import { FormEvent, useState } from "react";
import type {
  ClubParentRow,
  ParentsFilters,
} from "@/lib/members/parentsView";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./MembersTable.module.css";
import tabStyles from "./MembersTabs.module.css";

/** Props tableau parents. */
type ParentsTableProps = {
  rows: ClubParentRow[];
  filters: ParentsFilters;
  busy: boolean;
  onFiltersChange: (filters: ParentsFilters) => void;
  onInviteClick: () => void;
  onSelectRosterMember: (memberId: string) => void;
  onRevoke: (row: ClubParentRow, childMemberId: string) => void;
  onChangeEmail: (row: ClubParentRow, childMemberId: string, email: string) => void;
  onCopyInvite: (row: ClubParentRow) => void;
  onExtendInvite: (row: ClubParentRow, childMemberId: string) => void;
  onRegenerateInvite: (row: ClubParentRow, childMemberId: string) => void;
};

function statusLabel(row: ClubParentRow): string {
  if (row.status === "active") return "Connecté";
  if (row.primaryExpiresAt && !row.primaryInviteValid) {
    return `En attente · expirée le ${row.primaryExpiresAt.toLocaleDateString("fr-FR")}`;
  }
  if (row.primaryExpiresAt) {
    return `En attente · valable jusqu’au ${row.primaryExpiresAt.toLocaleDateString("fr-FR")}`;
  }
  return "En attente";
}

/** Tableau parents club-wide (filtre + actions). */
export function ParentsTable({
  rows,
  filters,
  busy,
  onFiltersChange,
  onInviteClick,
  onSelectRosterMember,
  onRevoke,
  onChangeEmail,
  onCopyInvite,
  onExtendInvite,
  onRegenerateInvite,
}: ParentsTableProps) {
  const [editingEmailKey, setEditingEmailKey] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");

  function startEditEmail(row: ClubParentRow) {
    const pendingChild = row.children.find((c) => c.status === "pending");
    if (!pendingChild) return;
    setEditingEmailKey(`${row.rowKey}:${pendingChild.memberId}`);
    setEmailDraft(row.email ?? "");
  }

  function handleEmailSubmit(event: FormEvent, row: ClubParentRow) {
    event.preventDefault();
    const pendingChild = row.children.find((c) => c.status === "pending");
    if (!pendingChild || !emailDraft.trim()) return;
    onChangeEmail(row, pendingChild.memberId, emailDraft.trim());
    setEditingEmailKey(null);
  }

  return (
    <div className={styles.layout}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <label className={`${styles.field} ${styles.fieldSearch}`}>
            <span className={styles.label}>Recherche</span>
            <input
              className={styles.input}
              type="search"
              value={filters.search}
              placeholder="Nom, email, enfant…"
              onChange={(event) =>
                onFiltersChange({ ...filters, search: event.target.value })
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Statut</span>
            <PlanningSelect
              id="parents-filter-status"
              value={filters.status}
              aria-label="Filtrer par statut"
              options={[
                { value: "all", label: "Tous" },
                { value: "pending", label: "En attente" },
                { value: "active", label: "Connectés" },
              ]}
              onChange={(next) =>
                onFiltersChange({
                  ...filters,
                  status: next as ParentsFilters["status"],
                })
              }
            />
          </label>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={onInviteClick}
          >
            Inviter un parent
          </button>
        </div>
      </div>

      <p className={styles.meta}>
        {rows.length} parent{rows.length > 1 ? "s" : ""}
      </p>

      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.tableParents}`}>
          <thead>
            <tr>
              <th>Parent</th>
              <th>E-mail</th>
              <th>Enfants</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  Aucun parent invité ou connecté.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const pendingChild = row.children.find(
                  (c) => c.status === "pending",
                );
                const isEditing =
                  pendingChild != null &&
                  editingEmailKey === `${row.rowKey}:${pendingChild.memberId}`;

                return (
                  <tr key={row.rowKey}>
                    <td>
                      <div className={styles.nameCell}>
                        <strong>
                          {row.displayName ||
                            [row.firstName, row.lastName]
                              .filter(Boolean)
                              .join(" ") ||
                            "Parent"}
                        </strong>
                        {row.rosterMemberId ? (
                          <button
                            type="button"
                            className={tabStyles.inlineLink}
                            disabled={busy}
                            onClick={() =>
                              onSelectRosterMember(row.rosterMemberId!)
                            }
                          >
                            Aussi membre
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      {isEditing ? (
                        <form
                          className={tabStyles.inlineForm}
                          onSubmit={(event) => handleEmailSubmit(event, row)}
                        >
                          <input
                            className={styles.input}
                            type="email"
                            value={emailDraft}
                            disabled={busy}
                            onChange={(event) =>
                              setEmailDraft(event.target.value)
                            }
                            aria-label="Nouvel e-mail parent"
                          />
                          <button
                            type="submit"
                            className={styles.buttonGhost}
                            disabled={busy}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            className={styles.buttonGhost}
                            disabled={busy}
                            onClick={() => setEditingEmailKey(null)}
                          >
                            Annuler
                          </button>
                        </form>
                      ) : (
                        row.email ?? "—"
                      )}
                    </td>
                    <td>
                      {row.children.map((child) => child.displayName).join(", ")}
                    </td>
                    <td>
                      <span
                        className={styles.badge}
                        data-tone={
                          row.status === "active"
                            ? "green"
                            : row.primaryInviteValid
                              ? "blue"
                              : "gray"
                        }
                      >
                        {statusLabel(row)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        {pendingChild ? (
                          <>
                            {row.primaryInvitationCode ? (
                              <button
                                type="button"
                                className={styles.buttonGhost}
                                disabled={busy}
                                onClick={() => onCopyInvite(row)}
                              >
                                Copier invite
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className={styles.buttonGhost}
                              disabled={busy}
                              onClick={() => startEditEmail(row)}
                            >
                              Changer mail
                            </button>
                            <button
                              type="button"
                              className={styles.buttonGhost}
                              disabled={busy}
                              onClick={() =>
                                onExtendInvite(row, pendingChild.memberId)
                              }
                            >
                              Prolonger
                            </button>
                            <button
                              type="button"
                              className={styles.buttonGhost}
                              disabled={busy}
                              onClick={() =>
                                onRegenerateInvite(row, pendingChild.memberId)
                              }
                            >
                              Renvoyer
                            </button>
                          </>
                        ) : null}
                        {row.children.map((child) => (
                          <button
                            key={child.memberId}
                            type="button"
                            className={styles.buttonGhost}
                            disabled={busy}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Révoquer le parent pour ${child.displayName} ?`,
                                )
                              ) {
                                return;
                              }
                              onRevoke(row, child.memberId);
                            }}
                          >
                            {row.children.length > 1
                              ? `Révoquer (${child.displayName})`
                              : "Révoquer"}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
