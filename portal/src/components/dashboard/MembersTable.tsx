"use client";

import type { TeamOption } from "@/lib/firebase/eventService";
import {
  isMemberInviteValid,
  memberRoleLabel,
} from "@/lib/firebase/memberService";
import { MemberFeeStatuses, MemberRoles } from "@/lib/firebase/constants";
import type { MemberRow, MembersFilters } from "@/lib/members/membersView";
import { PlanningSelect } from "./PlanningSelect";
import { InviteEmailButton } from "./InviteEmailButton";
import { MembersBulkBar } from "./MembersBulkBar";
import styles from "./MembersTable.module.css";

/** Props du tableau membres. */
type MembersTableProps = {
  rows: MemberRow[];
  teams: TeamOption[];
  filters: MembersFilters;
  selectedMemberId: string | null;
  selectedIds: Set<string>;
  seasonLabel: string | null;
  hasSeason: boolean;
  bulkBusy: boolean;
  inviteableSelectedCount: number;
  onFiltersChange: (next: MembersFilters) => void;
  onSelectMember: (memberId: string) => void;
  onToggleSelect: (memberId: string) => void;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onBulkSendInvites: () => void;
  onBulkSetFeeStatus: (status: string) => void;
  onBulkSetRole: (role: string) => void;
  onBulkExport: () => void;
  onCopyInvite: (member: MemberRow) => void;
  onEmailInvite: (member: MemberRow) => Promise<boolean>;
  onRegenerateInvite: (member: MemberRow) => void;
  onAddClick: () => void;
  onImportClick: () => void;
  onExportClick: () => void;
};

/** Tableau filtrable des membres du club. */
export function MembersTable({
  rows,
  teams,
  filters,
  selectedMemberId,
  selectedIds,
  seasonLabel,
  hasSeason,
  bulkBusy,
  inviteableSelectedCount,
  onFiltersChange,
  onSelectMember,
  onToggleSelect,
  onToggleSelectAll,
  onClearSelection,
  onBulkSendInvites,
  onBulkSetFeeStatus,
  onBulkSetRole,
  onBulkExport,
  onCopyInvite,
  onEmailInvite,
  onRegenerateInvite,
  onAddClick,
  onImportClick,
  onExportClick,
}: MembersTableProps) {
  const allSelected =
    rows.length > 0 && rows.every((row) => selectedIds.has(row.memberId));
  const someSelected =
    rows.some((row) => selectedIds.has(row.memberId)) && !allSelected;

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
              placeholder="Nom, email, licence…"
              onChange={(event) =>
                onFiltersChange({ ...filters, search: event.target.value })
              }
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Rôle</span>
            <PlanningSelect
              id="members-filter-role"
              value={filters.role}
              aria-label="Filtrer par rôle"
              options={[
                { value: "all", label: "Tous" },
                { value: MemberRoles.admin, label: "Admin" },
                { value: MemberRoles.coach, label: "Coach" },
                { value: MemberRoles.player, label: "Joueur" },
              ]}
              onChange={(next) =>
                onFiltersChange({
                  ...filters,
                  role: next as MembersFilters["role"],
                })
              }
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Équipe</span>
            <PlanningSelect
              id="members-filter-team"
              value={filters.teamId}
              aria-label="Filtrer par équipe"
              options={[
                { value: "all", label: "Toutes" },
                ...teams.map((team) => ({
                  value: team.id,
                  label: team.name,
                })),
              ]}
              onChange={(next) =>
                onFiltersChange({ ...filters, teamId: next })
              }
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Inscription</span>
            <PlanningSelect
              id="members-filter-registration"
              value={filters.registration}
              aria-label="Filtrer par inscription"
              options={[
                { value: "all", label: "Tous" },
                { value: "registered", label: "Inscrits" },
                { value: "pending", label: "Pas encore" },
              ]}
              onChange={(next) =>
                onFiltersChange({
                  ...filters,
                  registration: next as MembersFilters["registration"],
                })
              }
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Cotisation</span>
            <PlanningSelect
              id="members-filter-fee"
              value={filters.feeStatus}
              aria-label="Filtrer par cotisation"
              options={[
                { value: "all", label: "Tous" },
                { value: MemberFeeStatuses.aPayer, label: "À payer" },
                { value: MemberFeeStatuses.partiel, label: "Partiel" },
                { value: MemberFeeStatuses.paye, label: "Payé" },
                { value: MemberFeeStatuses.exonere, label: "Exonéré" },
              ]}
              onChange={(next) =>
                onFiltersChange({ ...filters, feeStatus: next })
              }
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={onExportClick}
          >
            Exporter CSV
          </button>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={onImportClick}
          >
            Importer CSV
          </button>
          <button
            type="button"
            className={styles.buttonIcon}
            onClick={onAddClick}
            aria-label="Ajouter un membre et envoyer une invitation"
            title="Ajouter un membre"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>

      <p className={styles.meta}>
        {rows.length} membre{rows.length > 1 ? "s" : ""}
        {seasonLabel ? ` · Saison ${seasonLabel}` : " · Aucune saison active"}
        {selectedIds.size > 0
          ? ` · ${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}`
          : ""}
      </p>

      {rows.length === 0 ? (
        <p className={styles.empty}>Aucun membre ne correspond aux filtres.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.checkCol}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={allSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = someSelected;
                    }}
                    onChange={onToggleSelectAll}
                    aria-label="Sélectionner tous les membres visibles"
                  />
                </th>
                <th scope="col">Nom</th>
                <th scope="col">Rôle</th>
                <th scope="col">Équipes</th>
                <th scope="col">Inscription</th>
                <th scope="col">Licence</th>
                <th scope="col">Cotisation</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.memberId}
                  data-selected={selectedMemberId === row.memberId}
                  data-checked={selectedIds.has(row.memberId)}
                  onClick={() => onSelectMember(row.memberId)}
                >
                  <td className={styles.checkCol}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedIds.has(row.memberId)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => onToggleSelect(row.memberId)}
                      aria-label={`Sélectionner ${row.displayName}`}
                    />
                  </td>
                  <td>
                    <div className={styles.nameCell}>
                      <span className={styles.name}>{row.displayName}</span>
                      {row.email ? (
                        <span className={styles.sub}>{row.email}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <span className={styles.badge} data-tone={row.role}>
                      {memberRoleLabel(row.role)}
                    </span>
                  </td>
                  <td>
                    {row.teamNames.length > 0
                      ? row.teamNames.join(", ")
                      : "—"}
                  </td>
                  <td>
                    {row.hasLinkedAccount ? (
                      <span className={styles.badge} data-tone="ok">
                        Inscrit
                      </span>
                    ) : (
                      <span className={styles.badge} data-tone="pending">
                        Pas encore
                      </span>
                    )}
                  </td>
                  <td>{row.license || "—"}</td>
                  <td>{row.feeStatusLabel}</td>
                  <td>
                    <div className={styles.rowActions}>
                      {!row.hasLinkedAccount && isMemberInviteValid(row) ? (
                        <>
                          {row.email ? (
                            <InviteEmailButton
                              variant="ghost"
                              stopPropagation
                              onSend={() => onEmailInvite(row)}
                            />
                          ) : null}
                          <button
                            type="button"
                            className={styles.buttonGhost}
                            onClick={(event) => {
                              event.stopPropagation();
                              onCopyInvite(row);
                            }}
                          >
                            Copier
                          </button>
                        </>
                      ) : null}
                      {!row.hasLinkedAccount && !isMemberInviteValid(row) ? (
                        <button
                          type="button"
                          className={styles.buttonGhost}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRegenerateInvite(row);
                          }}
                        >
                          Générer code invitation app
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MembersBulkBar
        selectedCount={selectedIds.size}
        busy={bulkBusy}
        hasSeason={hasSeason}
        inviteableCount={inviteableSelectedCount}
        onClear={onClearSelection}
        onSendInvites={onBulkSendInvites}
        onSetFeeStatus={onBulkSetFeeStatus}
        onSetRole={onBulkSetRole}
        onExportSelected={onBulkExport}
      />
    </div>
  );
}
