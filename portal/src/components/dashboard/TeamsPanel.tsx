"use client";

import { useMemo, useState } from "react";
import { AddTeamMemberDialog } from "@/components/dashboard/AddTeamMemberDialog";
import {
  CreateTeamDialog,
  EditTeamDialog,
  type TeamFormValues,
} from "@/components/dashboard/CreateTeamDialog";
import { TeamCard } from "@/components/dashboard/TeamCard";
import type { TeamOption } from "@/lib/firebase/eventService";
import { MemberRoles } from "@/lib/firebase/constants";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import {
  groupTeamsByCategory,
  type TeamRosterRole,
} from "@/lib/firebase/teamService";
import { teamCategoryTone } from "@/lib/teams/teamCategoryTone";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./TeamsPanel.module.css";

type TeamsPanelProps = {
  clubId: string;
  teams: TeamOption[];
  members: ClubMemberRecord[];
  sport: string;
  busy: boolean;
  error: string | null;
  highlightedTeamId?: string | null;
  canCreateTeam?: boolean;
  canEditTeam?: boolean;
  canDeleteTeam?: boolean;
  canManageCoaches?: boolean;
  canRemovePlayers?: boolean;
  /** True si le viewer peut ajouter un joueur à cette équipe. */
  canAddPlayerToTeam?: (team: TeamOption) => boolean;
  /**
   * Vue joueur / parent : barre d’outils et tuiles centrées
   * (comme l’accueil joueur).
   */
  centered?: boolean;
  onClearError?: () => void;
  onCreateTeam: (values: TeamFormValues) => Promise<void>;
  onUpdateTeam: (
    teamId: string,
    values: TeamFormValues,
  ) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onAddMember: (params: {
    teamId: string;
    memberId: string;
    role: TeamRosterRole;
  }) => Promise<void>;
  onRemoveMember: (params: {
    teamId: string;
    memberId: string;
    accountUid: string | null;
    role: TeamRosterRole;
  }) => Promise<void>;
};

/** Panneau gestion des équipes (liste par catégorie + dialogs). */
export function TeamsPanel({
  clubId,
  teams,
  members,
  sport,
  busy,
  error,
  highlightedTeamId = null,
  canCreateTeam = true,
  canEditTeam = true,
  canDeleteTeam = true,
  canManageCoaches = true,
  canRemovePlayers = true,
  canAddPlayerToTeam,
  centered = false,
  onClearError,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onAddMember,
  onRemoveMember,
}: TeamsPanelProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamOption | null>(null);
  const [addingToTeam, setAddingToTeam] = useState<{
    team: TeamOption;
    role: TeamRosterRole;
  } | null>(null);

  const categoryOptions = useMemo(() => {
    const categories = [
      ...new Set(
        teams
          .map((team) => team.category.trim())
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "fr"));
    return [
      { value: "all", label: "Toutes" },
      ...categories.map((category) => ({ value: category, label: category })),
      { value: "__none__", label: "Sans catégorie" },
    ];
  }, [teams]);

  const membersByRosterId = useMemo(() => {
    const byId = new Map<string, ClubMemberRecord>();
    for (const member of members) {
      byId.set(member.memberId, member);
      if (member.accountUid) byId.set(member.accountUid, member);
    }
    return byId;
  }, [members]);

  const filteredTeams = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return teams.filter((team) => {
      if (categoryFilter === "__none__" && team.category.trim()) return false;
      if (
        categoryFilter !== "all" &&
        categoryFilter !== "__none__" &&
        team.category.trim() !== categoryFilter
      ) {
        return false;
      }
      if (!needle) return true;
      if (
        team.name.toLowerCase().includes(needle) ||
        team.category.toLowerCase().includes(needle)
      ) {
        return true;
      }
      return [...team.playerIds, ...team.coachIds].some((rosterId) => {
        const member = membersByRosterId.get(rosterId);
        return member?.displayName.toLowerCase().includes(needle) ?? false;
      });
    });
  }, [teams, search, categoryFilter, membersByRosterId]);

  const grouped = useMemo(
    () => groupTeamsByCategory(filteredTeams),
    [filteredTeams],
  );

  /** IDs déjà présents sur le slot roster (aligné app Flutter). */
  function excludedIdsForTeam(
    team: TeamOption,
    role: TeamRosterRole,
  ): Set<string> {
    return new Set(
      role === MemberRoles.coach ? team.coachIds : team.playerIds,
    );
  }

  function openCreateTeam() {
    onClearError?.();
    setShowCreate(true);
  }

  const addTeamTile = canCreateTeam ? (
    <button
      type="button"
      className={styles.addTeamTile}
      disabled={busy}
      aria-label="Nouvelle équipe"
      onClick={openCreateTeam}
    >
      <span className={styles.addTeamTileIcon} aria-hidden>
        +
      </span>
      <span className={styles.addTeamTileLabel}>Nouvelle équipe</span>
    </button>
  ) : null;

  return (
    <div className={`${styles.layout}${centered ? ` ${styles.layoutCentered}` : ""}`}>
      {centered ? null : (
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <label className={`${styles.field} ${styles.fieldSearch}`}>
            <span className={styles.label}>Recherche</span>
            <input
              className={styles.input}
              type="search"
              value={search}
              placeholder="Nom, catégorie, joueur, coach…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Catégorie</span>
            <PlanningSelect
              id="teams-filter-category"
              value={categoryFilter}
              aria-label="Filtrer par catégorie"
              options={categoryOptions}
              onChange={setCategoryFilter}
            />
          </label>
        </div>
      </div>
      )}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {filteredTeams.length === 0 ? (
        <div className={styles.emptyBlock}>
          <p className={styles.empty}>
            {teams.length === 0
              ? canCreateTeam
                ? "Aucune équipe pour ce club. Créez la première pour organiser joueurs et coachs."
                : "Aucune équipe pour ce club."
              : "Aucune équipe ne correspond aux filtres."}
          </p>
          {addTeamTile ? (
            <div className={styles.addTeamColumn}>{addTeamTile}</div>
          ) : null}
        </div>
      ) : (
        <div className={styles.groups}>
          {grouped.map((group) => (
            <section
              key={group.category}
              className={styles.group}
              data-tone={teamCategoryTone(group.category)}
            >
              <h3 className={styles.groupTitle}>{group.category}</h3>
              <div className={styles.cards}>
                {group.teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    clubId={clubId}
                    team={team}
                    members={members}
                    busy={busy}
                    searchQuery={search}
                    highlighted={highlightedTeamId === team.id}
                    canEdit={canEditTeam}
                    canDelete={canDeleteTeam}
                    canAddCoach={canManageCoaches}
                    canRemoveCoach={canManageCoaches}
                    canAddPlayer={
                      canAddPlayerToTeam
                        ? canAddPlayerToTeam(team)
                        : true
                    }
                    canRemovePlayer={canRemovePlayers}
                    onEdit={() => {
                      onClearError?.();
                      setEditingTeam(team);
                    }}
                    onDelete={() => {
                      if (
                        !window.confirm(
                          `Supprimer l’équipe « ${team.name} » ? Les membres ne seront pas retirés du club.`,
                        )
                      ) {
                        return;
                      }
                      void onDeleteTeam(team.id);
                    }}
                    onAddMember={(role) => {
                      onClearError?.();
                      setAddingToTeam({ team, role });
                    }}
                    onRemoveMember={(person, role) => {
                      void onRemoveMember({
                        teamId: team.id,
                        memberId: person.memberId,
                        accountUid: person.accountUid,
                        role,
                      });
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
          {addTeamTile ? (
            <div className={styles.addTeamColumn}>{addTeamTile}</div>
          ) : null}
        </div>
      )}

      {showCreate && canCreateTeam ? (
        <CreateTeamDialog
          sport={sport}
          busy={busy}
          error={error}
          onClose={() => setShowCreate(false)}
          onSubmit={async (values) => {
            await onCreateTeam(values);
            setShowCreate(false);
          }}
        />
      ) : null}

      {editingTeam ? (
        <EditTeamDialog
          sport={sport}
          busy={busy}
          error={error}
          initialName={editingTeam.name}
          initialCategory={editingTeam.category}
          onClose={() => setEditingTeam(null)}
          onSubmit={async (values) => {
            await onUpdateTeam(editingTeam.id, values);
            setEditingTeam(null);
          }}
        />
      ) : null}

      {addingToTeam ? (
        <AddTeamMemberDialog
          role={addingToTeam.role}
          members={members}
          excludedIds={excludedIdsForTeam(
            addingToTeam.team,
            addingToTeam.role,
          )}
          busy={busy}
          error={error}
          onClose={() => setAddingToTeam(null)}
          onSubmit={async (memberId) => {
            await onAddMember({
              teamId: addingToTeam.team.id,
              memberId,
              role: addingToTeam.role,
            });
            setAddingToTeam(null);
          }}
        />
      ) : null}
    </div>
  );
}
