"use client";

import { useMemo, useState } from "react";
import type { TeamOption } from "@/lib/firebase/eventService";
import {
  isMemberInviteValid,
  memberRoleLabel,
  memberRoleLevel,
} from "@/lib/firebase/memberService";
import { MemberFeeStatuses, MemberRoles } from "@/lib/firebase/constants";
import type { MemberRow, MembersFilters } from "@/lib/members/membersView";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { PlanningSelect } from "./PlanningSelect";
import { InviteEmailButton } from "./InviteEmailButton";
import { MembersBulkBar } from "./MembersBulkBar";
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
        <div className={styles.tableShell}>
          <FadeScrollArea className={styles.tableWrap} axis="horizontal">
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
                  <th scope="col">Actions invitation</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
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
                        <RoleBadgeIcon role={row.role} />
                        {memberRoleLabel(row.role)}
                      </span>
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
          </FadeScrollArea>
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

/** Icône de rôle (alignée sur ViroRoleBadge Flutter / Phosphor fill). */
function RoleBadgeIcon({ role }: { role: string }) {
  const path =
    role === MemberRoles.admin
      ? "M208,40H48A16,16,0,0,0,32,56v58.78c0,89.61,75.82,119.34,91,124.39a15.53,15.53,0,0,0,10,0c15.2-5.05,91-34.78,91-124.39V56A16,16,0,0,0,208,40Zm-34.34,69.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"
      : role === MemberRoles.coach
        ? "M228.54,86.66l-176.06-54A16,16,0,0,0,32,48V192a16,16,0,0,0,16,16,16,16,0,0,0,4.52-.65L136,181.73V192a16,16,0,0,0,16,16h32a16,16,0,0,0,16-16v-29.9l28.54-8.75A16.09,16.09,0,0,0,240,138V102A16.09,16.09,0,0,0,228.54,86.66ZM184,192H152V176.82L184,167Zm40-54-.11,0L152,160.08V79.91L223.89,102l.11,0v36Z"
        : "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm8,39.38,24.79-17.05a88.41,88.41,0,0,1,36.18,27l-8,26.94c-.2,0-.41.1-.61.17l-22.82,7.41a7.59,7.59,0,0,0-1,.4L136,88.62c0-.2,0-.41,0-.62V64C136,63.79,136,63.58,136,63.38ZM95.24,46.33,120,63.38c0,.2,0,.41,0,.62V88c0,.21,0,.42,0,.62L91.44,108.29a7.59,7.59,0,0,0-1-.4l-22.82-7.41c-.2-.07-.41-.12-.61-.17l-8-26.94A88.41,88.41,0,0,1,95.24,46.33Zm-13,129.09H53.9a87.4,87.4,0,0,1-13.79-43.07l22-16.88a5.77,5.77,0,0,0,.58.22l22.83,7.42a7.83,7.83,0,0,0,.93.22l10.79,31.42c-.15.18-.3.36-.44.55L82.7,174.71A7.8,7.8,0,0,0,82.24,175.42ZM150.69,213a88.16,88.16,0,0,1-45.38,0L95.25,184.6c.13-.16.27-.31.39-.48l14.11-19.42a7.66,7.66,0,0,0,.46-.7h35.58a7.66,7.66,0,0,0,.46.7l14.11,19.42c.12.17.26.32.39.48Zm23.07-37.61a7.8,7.8,0,0,0-.46-.71L159.19,155.3c-.14-.19-.29-.37-.44-.55l10.79-31.42a7.83,7.83,0,0,0,.93-.22l22.83-7.42a5.77,5.77,0,0,0,.58-.22l22,16.88a87.4,87.4,0,0,1-13.79,43.07Z";

  return (
    <span className={styles.badgeIcon} aria-hidden>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        fill="currentColor"
      >
        <path d={path} />
      </svg>
    </span>
  );
}
