"use client";

import { useMemo, useState } from "react";
import type { TeamOption } from "@/lib/firebase/eventService";
import {
  isMemberInviteValid,
  memberRoleLevel,
} from "@/lib/firebase/memberService";
import { MemberFeeStatuses, MemberRoles } from "@/lib/firebase/constants";
import type { MemberRow, MembersFilters } from "@/lib/members/membersView";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { PlanningSelect } from "./PlanningSelect";
import { InviteEmailButton } from "./InviteEmailButton";
import { MemberAvatar } from "./MemberAvatar";
import { MembersBulkBar } from "./MembersBulkBar";
import { RoleBadge } from "./RoleBadge";
import styles from "./MembersTable.module.css";

type SortColumn =
  | "name"
  | "role"
  | "teams"
  | "registration"
  | "license"
  | "fee";

type SortDirection = "asc" | "desc";

const FEE_SORT_ORDER: Record<string, number> = {
  [MemberFeeStatuses.aPayer]: 0,
  [MemberFeeStatuses.partiel]: 1,
  [MemberFeeStatuses.paye]: 2,
  [MemberFeeStatuses.exonere]: 3,
};

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
  /** Affiche le bouton d’ajout (admin / coach). */
  canAddMember?: boolean;
  /** Affiche l’import CSV (admin). */
  canImportMembers?: boolean;
  /** Affiche cases à cocher + barre groupée. */
  canSelectRows?: boolean;
  /** Affiche les actions invitation en ligne. */
  canInviteActions?: boolean;
  /** Cotisation / rôle groupés (admin). */
  showAdminBulkActions?: boolean;
  /** True si l’e-mail du membre peut être affiché. */
  canSeeContact?: (member: MemberRow) => boolean;
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

/** Tableau filtrable et triable des membres du club. */
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
  canAddMember = true,
  canImportMembers = true,
  canSelectRows = true,
  canInviteActions = true,
  showAdminBulkActions = true,
  canSeeContact,
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
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const allSelected =
    rows.length > 0 && rows.every((row) => selectedIds.has(row.memberId));
  const someSelected =
    rows.some((row) => selectedIds.has(row.memberId)) && !allSelected;

  const sortedRows = useMemo(
    () => sortMemberRows(rows, sortColumn, sortDirection),
    [rows, sortColumn, sortDirection],
  );

  /** Applique immédiatement le tri sur la colonne cliquée. */
  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
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
          {canImportMembers ? (
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={onImportClick}
            >
              Importer CSV
            </button>
          ) : null}
          {canAddMember ? (
            <button
              type="button"
              className={styles.buttonIcon}
              onClick={onAddClick}
              aria-label="Ajouter un membre et envoyer une invitation"
              title="Ajouter un membre"
            >
              <span aria-hidden="true">+</span>
            </button>
          ) : null}
        </div>
      </div>

      <p className={styles.meta}>
        {rows.length} membre{rows.length > 1 ? "s" : ""}
        {seasonLabel ? ` · Saison ${seasonLabel}` : " · Aucune saison active"}
        {canSelectRows && selectedIds.size > 0
          ? ` · ${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}`
          : ""}
      </p>

      {rows.length === 0 ? (
        <p className={styles.empty}>Aucun membre ne correspond aux filtres.</p>
      ) : (
        <div className={styles.tableShell}>
          <FadeScrollArea className={styles.tableWrap} axis="horizontal">
            <table className={styles.table}>
              <thead>
                <tr>
                  {canSelectRows ? (
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
                  ) : null}
                  <SortableHeader
                    label="Nom"
                    column="name"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Rôle"
                    column="role"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Équipes"
                    column="teams"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Inscription"
                    column="registration"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Licence"
                    column="license"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Cotisation"
                    column="fee"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  {canInviteActions ? (
                    <th scope="col">Actions invitation</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const showContact =
                    canSeeContact?.(row) ?? Boolean(row.email);
                  return (
                    <tr
                      key={row.memberId}
                      data-selected={selectedMemberId === row.memberId}
                      data-checked={
                        canSelectRows && selectedIds.has(row.memberId)
                      }
                      onClick={() => onSelectMember(row.memberId)}
                    >
                      {canSelectRows ? (
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
                      ) : null}
                      <td>
                        <div className={styles.nameCell}>
                          <MemberAvatar
                            displayName={row.displayName}
                            avatarUrl={row.avatarUrl}
                            hasLinkedAccount={row.hasLinkedAccount}
                          />
                          <div className={styles.nameText}>
                            <span className={styles.name}>{row.displayName}</span>
                            {showContact && row.email ? (
                              <span className={styles.sub}>{row.email}</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <RoleBadge role={row.role} />
                      </td>
                      <td>
                        {row.teamLabels.length > 0
                          ? row.teamLabels.join(", ")
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
                      {canInviteActions ? (
                        <td>
                          <div className={styles.rowActions}>
                            {!row.hasLinkedAccount &&
                            isMemberInviteValid(row) ? (
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
                            {!row.hasLinkedAccount &&
                            !isMemberInviteValid(row) ? (
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
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </FadeScrollArea>
        </div>
      )}

      {canSelectRows ? (
        <MembersBulkBar
          selectedCount={selectedIds.size}
          busy={bulkBusy}
          hasSeason={hasSeason}
          inviteableCount={inviteableSelectedCount}
          showInviteActions={canInviteActions}
          showAdminBulkActions={showAdminBulkActions}
          onClear={onClearSelection}
          onSendInvites={onBulkSendInvites}
          onSetFeeStatus={onBulkSetFeeStatus}
          onSetRole={onBulkSetRole}
          onExportSelected={onBulkExport}
        />
      ) : null}
    </div>
  );
}

type SortableHeaderProps = {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
};

/** En-tête de colonne cliquable pour trier le tableau. */
function SortableHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
}: SortableHeaderProps) {
  const isActive = activeColumn === column;
  const ariaSort = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th scope="col" aria-sort={ariaSort}>
      <button
        type="button"
        className={styles.sortButton}
        data-active={isActive ? "true" : undefined}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        <span className={styles.sortIndicator} aria-hidden>
          {isActive ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

/** Trie les lignes membres selon la colonne et le sens choisis. */
function sortMemberRows(
  rows: MemberRow[],
  column: SortColumn,
  direction: SortDirection,
): MemberRow[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const compared = compareMemberRows(left, right, column);
    if (compared !== 0) return compared * factor;
    return left.displayName.localeCompare(right.displayName, "fr") * factor;
  });
}

/** Compare deux lignes pour une colonne de tri. */
function compareMemberRows(
  left: MemberRow,
  right: MemberRow,
  column: SortColumn,
): number {
  switch (column) {
    case "name":
      return left.displayName.localeCompare(right.displayName, "fr");
    case "role":
      return memberRoleLevel(right.role) - memberRoleLevel(left.role);
    case "teams":
      return (left.teamLabels[0] ?? "").localeCompare(
        right.teamLabels[0] ?? "",
        "fr",
      );
    case "registration":
      return Number(left.hasLinkedAccount) - Number(right.hasLinkedAccount);
    case "license":
      return (left.license || "").localeCompare(right.license || "", "fr");
    case "fee": {
      const leftOrder = left.feeStatus
        ? (FEE_SORT_ORDER[left.feeStatus] ?? 99)
        : 100;
      const rightOrder = right.feeStatus
        ? (FEE_SORT_ORDER[right.feeStatus] ?? 99)
        : 100;
      return leftOrder - rightOrder;
    }
    default:
      return 0;
  }
}
