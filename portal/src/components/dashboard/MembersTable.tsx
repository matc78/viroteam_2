"use client";

import type { TeamOption } from "@/lib/firebase/eventService";
import {
  isMemberInviteValid,
  memberRoleLabel,
} from "@/lib/firebase/memberService";
import { MemberFeeStatuses, MemberRoles } from "@/lib/firebase/constants";
import type { MemberRow, MembersFilters } from "@/lib/members/membersView";
import styles from "./MembersTable.module.css";

/** Props du tableau membres. */
type MembersTableProps = {
  rows: MemberRow[];
  teams: TeamOption[];
  filters: MembersFilters;
  selectedMemberId: string | null;
  seasonLabel: string | null;
  onFiltersChange: (next: MembersFilters) => void;
  onSelectMember: (memberId: string) => void;
  onCopyInvite: (member: MemberRow) => void;
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
  seasonLabel,
  onFiltersChange,
  onSelectMember,
  onCopyInvite,
  onRegenerateInvite,
  onAddClick,
  onImportClick,
  onExportClick,
}: MembersTableProps) {
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
            <select
              className={styles.select}
              value={filters.role}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  role: event.target.value as MembersFilters["role"],
                })
              }
            >
              <option value="all">Tous</option>
              <option value={MemberRoles.admin}>Admin</option>
              <option value={MemberRoles.coach}>Coach</option>
              <option value={MemberRoles.player}>Joueur</option>
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Équipe</span>
            <select
              className={styles.select}
              value={filters.teamId}
              onChange={(event) =>
                onFiltersChange({ ...filters, teamId: event.target.value })
              }
            >
              <option value="all">Toutes</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Inscription</span>
            <select
              className={styles.select}
              value={filters.registration}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  registration: event.target
                    .value as MembersFilters["registration"],
                })
              }
            >
              <option value="all">Tous</option>
              <option value="registered">Inscrits</option>
              <option value="pending">Pas encore</option>
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Cotisation</span>
            <select
              className={styles.select}
              value={filters.feeStatus}
              onChange={(event) =>
                onFiltersChange({ ...filters, feeStatus: event.target.value })
              }
            >
              <option value="all">Tous</option>
              <option value={MemberFeeStatuses.aPayer}>À payer</option>
              <option value={MemberFeeStatuses.partiel}>Partiel</option>
              <option value={MemberFeeStatuses.paye}>Payé</option>
              <option value={MemberFeeStatuses.exonere}>Exonéré</option>
            </select>
          </label>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.buttonSecondary} onClick={onExportClick}>
            Exporter CSV
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={onImportClick}>
            Importer CSV
          </button>
          <button type="button" className={styles.button} onClick={onAddClick}>
            Ajouter
          </button>
        </div>
      </div>

      <p className={styles.meta}>
        {rows.length} membre{rows.length > 1 ? "s" : ""}
        {seasonLabel ? ` · Saison ${seasonLabel}` : " · Aucune saison active"}
      </p>

      {rows.length === 0 ? (
        <p className={styles.empty}>Aucun membre ne correspond aux filtres.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
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
                  onClick={() => onSelectMember(row.memberId)}
                >
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
                        <button
                          type="button"
                          className={styles.buttonGhost}
                          onClick={(event) => {
                            event.stopPropagation();
                            onCopyInvite(row);
                          }}
                        >
                          Copier invite
                        </button>
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
    </div>
  );
}
