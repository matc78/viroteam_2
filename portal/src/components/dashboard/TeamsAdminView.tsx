"use client";

import { useEffect, useMemo, useState } from "react";
import { AddTeamMemberDialog } from "@/components/dashboard/AddTeamMemberDialog";
import {
  CreateTeamDialog,
  EditTeamDialog,
  type TeamFormValues,
} from "@/components/dashboard/CreateTeamDialog";
import { InviteTeamDialog } from "@/components/dashboard/InviteTeamDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/icons";
import { ListRow, ListRows } from "@/components/ui/ListRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedChoice } from "@/components/ui/SegmentedChoice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { TeamOption } from "@/lib/firebase/eventService";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import type { TeamRosterRole } from "@/lib/firebase/teamService";
import {
  ALL_CATEGORIES,
  buildTeamListGroups,
  clubTeamCategoryTones,
  summarizeTeams,
  NO_CATEGORY,
  NO_CATEGORY_LABEL,
  teamCategoryFilterOptions,
  teamCategoryToneOf,
  teamMonogram,
  type TeamListEntry,
} from "@/lib/teams/teamsOverview";
import { TeamDetailPanel } from "./TeamDetailPanel";
import styles from "./TeamsAdminView.module.css";

type HealthFilter = "all" | "incomplete";

/** Props de la vue bureau Équipes. */
type TeamsAdminViewProps = {
  clubId: string;
  clubName: string;
  teams: TeamOption[];
  members: ClubMemberRecord[];
  sport: string;
  busy: boolean;
  error: string | null;
  viewerMemberId: string | null;
  /** Équipe à ouvrir au chargement (lien `?team=`). */
  openTeamId: string | null;
  onOpenTeamHandled: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  /** Créer / modifier / supprimer une équipe, nommer les coachs. */
  canManageTeams: boolean;
  canAddPlayerToTeam: (team: TeamOption) => boolean;
  canShareTeamInvite: (team: TeamOption) => boolean;
  onClearError: () => void;
  onCreateTeam: (values: TeamFormValues) => Promise<void>;
  onUpdateTeam: (teamId: string, values: TeamFormValues) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<boolean>;
  onAddMember: (params: {
    teamId: string;
    memberId: string;
    role: TeamRosterRole;
  }) => Promise<void>;
  onRemoveMember: (params: {
    teamId: string;
    memberId: string;
    role: TeamRosterRole;
  }) => Promise<void>;
  onSetSparring: (params: {
    teamId: string;
    memberId: string;
    sparring: boolean;
  }) => Promise<void>;
};

/** Pluriel simple (« 1 équipe », « 3 équipes »). */
function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count > 1 ? "s" : ""}`;
}

/** Résumé des coachs d’une ligne : « Coach : A » / « Coachs : A, B +2 ». */
function coachSummary(
  coachIds: string[],
  memberNames: ReadonlyMap<string, string>,
): string | null {
  const names = coachIds
    .map((id) => memberNames.get(id))
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b, "fr"));
  if (names.length === 0) return null;
  const shown = names.slice(0, 2).join(", ");
  const rest = names.length - 2;
  const label = names.length > 1 ? "Coachs" : "Coach";
  return `${label} : ${shown}${rest > 0 ? ` +${rest}` : ""}`;
}

/**
 * Page Équipes du bureau : liste dense groupée par catégorie, alertes
 * d’effectif, filtres, et détail d’une équipe dans un panneau latéral.
 */
export function TeamsAdminView({
  clubId,
  clubName,
  teams,
  members,
  sport,
  busy,
  error,
  viewerMemberId,
  openTeamId,
  onOpenTeamHandled,
  refreshing,
  onRefresh,
  canManageTeams,
  canAddPlayerToTeam,
  canShareTeamInvite,
  onClearError,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onAddMember,
  onRemoveMember,
  onSetSparring,
}: TeamsAdminViewProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamOption | null>(null);
  const [invitingTeam, setInvitingTeam] = useState<TeamOption | null>(null);
  const [addingRole, setAddingRole] = useState<TeamRosterRole | null>(null);

  useEffect(() => {
    if (!openTeamId) return;
    if (teams.some((team) => team.id === openTeamId)) {
      setSelectedTeamId(openTeamId);
    }
    onOpenTeamHandled();
  }, [openTeamId, teams, onOpenTeamHandled]);

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.memberId, member])),
    [members],
  );
  const memberNames = useMemo(
    () =>
      new Map(members.map((member) => [member.memberId, member.displayName])),
    [members],
  );
  const overview = useMemo(() => summarizeTeams(teams), [teams]);
  const categoryOptions = useMemo(
    () => teamCategoryFilterOptions(teams, sport),
    [teams, sport],
  );
  // Une couleur distincte par catégorie du club, dans l’ordre des puces.
  const categoryTones = useMemo(
    () => clubTeamCategoryTones(teams, sport),
    [teams, sport],
  );
  /** Ton d’une catégorie (libellé affiché ou vide). */
  const toneOf = (categoryLabel: string) =>
    teamCategoryToneOf(categoryTones, categoryLabel);
  const groups = useMemo(
    () =>
      buildTeamListGroups(
        teams,
        { search, category, onlyIncomplete: healthFilter === "incomplete" },
        memberNames,
        sport,
      ),
    [teams, search, category, healthFilter, memberNames, sport],
  );

  const selectedTeam =
    teams.find((team) => team.id === selectedTeamId) ?? null;
  const searchActive = search.trim().length > 0;
  const filtersActive =
    searchActive || category !== ALL_CATEGORIES || healthFilter !== "all";
  // Les alertes servent à qui peut corriger (nommer un coach) : le bureau.
  const showHealth = canManageTeams && overview.incompleteCount > 0;

  /** Ouvre / ferme une catégorie de la liste. */
  function toggleGroup(groupCategory: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(groupCategory)) next.delete(groupCategory);
      else next.add(groupCategory);
      return next;
    });
  }

  /** Réinitialise recherche et filtres. */
  function resetFilters() {
    setSearch("");
    setCategory(ALL_CATEGORIES);
    setHealthFilter("all");
  }

  /** « N à compléter » d’une catégorie : n’affiche que ses équipes incomplètes. */
  function showIncompleteInCategory(groupCategory: string) {
    setHealthFilter("incomplete");
    setCategory(
      groupCategory === NO_CATEGORY_LABEL ? NO_CATEGORY : groupCategory,
    );
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete(groupCategory);
      return next;
    });
  }

  /** Ligne d’une équipe : nom, coachs (ou membres trouvés), alertes, effectif. */
  function renderRow(entry: TeamListEntry) {
    const { team, issues, matchedMemberNames } = entry;
    const coaches = coachSummary(team.coachIds, memberNames);
    const meta =
      matchedMemberNames.length > 0
        ? `Contient : ${matchedMemberNames.slice(0, 3).join(", ")}${
            matchedMemberNames.length > 3
              ? ` +${matchedMemberNames.length - 3}`
              : ""
          }`
        : coaches;
    return (
      <ListRow
        key={team.id}
        selected={team.id === selectedTeamId}
        onClick={() => {
          onClearError();
          setSelectedTeamId(team.id);
        }}
        leading={
          <span className={styles.monogram} aria-hidden>
            {teamMonogram(team.name, team.category)}
          </span>
        }
        title={team.name}
        meta={meta ?? undefined}
        trailing={
          <>
            {/* Alertes en texte : la ligne est déjà un bouton ; le panneau
                qu’elle ouvre porte les mêmes alertes, cliquables. */}
            {issues.includes("noCoach") && canManageTeams ? (
              <span className={styles.issue}>Sans coach</span>
            ) : null}
            {issues.includes("noPlayer") ? (
              <span className={styles.issue}>Aucun joueur</span>
            ) : (
              <span className={styles.playerCount}>
                {countLabel(team.playerIds.length, "joueur")}
              </span>
            )}
            <Icon
              name="chevronRight"
              size={18}
              className={styles.rowChevron}
            />
          </>
        }
      />
    );
  }

  return (
    <div className={styles.root} data-panel-open={selectedTeam ? "true" : undefined}>
      <PageHeader
        eyebrow={clubName || "Espace club"}
        title="Équipes"
        description={
          teams.length > 0
            ? `${countLabel(overview.teamCount, "équipe")} · ${countLabel(
                overview.playerCount,
                "joueur",
              )} · ${countLabel(overview.coachCount, "coach")}`
            : undefined
        }
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRefresh}
              disabled={refreshing}
              aria-busy={refreshing}
            >
              {refreshing ? "Actualisation…" : "Actualiser"}
            </Button>
            {canManageTeams ? (
              <Button
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() => {
                  onClearError();
                  setShowCreate(true);
                }}
              >
                <Icon name="plus" size={16} />
                Nouvelle équipe
              </Button>
            ) : null}
          </>
        }
      />

      {showHealth && healthFilter === "all" ? (
        <Card variant="attention" className={styles.healthCard}>
          <p className={styles.healthText}>
            <strong>
              {countLabel(overview.incompleteCount, "équipe")} à compléter
            </strong>
            {" — "}
            {[
              overview.noCoachCount > 0
                ? `${overview.noCoachCount} sans coach`
                : null,
              overview.noPlayerCount > 0
                ? `${overview.noPlayerCount} sans joueur`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setHealthFilter("incomplete")}
          >
            Les afficher
          </Button>
        </Card>
      ) : null}

      {teams.length > 0 ? (
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <Icon name="search" size={18} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="search"
              value={search}
              placeholder="Rechercher une équipe, un joueur, un coach…"
              aria-label="Rechercher une équipe, un joueur ou un coach"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {showHealth || healthFilter === "incomplete" ? (
            <SegmentedChoice<HealthFilter>
              size="sm"
              ariaLabel="Filtrer par état de l’effectif"
              value={healthFilter}
              onSelect={setHealthFilter}
              options={[
                { value: "all", label: "Toutes" },
                {
                  value: "incomplete",
                  label: `À compléter (${overview.incompleteCount})`,
                  tone: "warning",
                },
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {categoryOptions.length > 2 ? (
        <div
          className={styles.categoryChips}
          role="group"
          aria-label="Filtrer par catégorie"
        >
          {categoryOptions.map((option) => {
            const active = category === option.value;
            const tone =
              option.value === ALL_CATEGORIES
                ? undefined
                : toneOf(
                    option.value === NO_CATEGORY
                      ? NO_CATEGORY_LABEL
                      : option.value,
                  );
            return (
              <button
                key={option.value}
                type="button"
                className={styles.categoryChip}
                data-tone={tone}
                aria-pressed={active}
                onClick={() =>
                  setCategory(
                    active && option.value !== ALL_CATEGORIES
                      ? ALL_CATEGORIES
                      : option.value,
                  )
                }
              >
                {tone ? <span className={styles.toneDot} aria-hidden /> : null}
                {option.label}
                <span className={styles.categoryChipCount}>{option.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {error && !selectedTeam ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {teams.length === 0 ? (
        <Card>
          <EmptyState
            variant="block"
            title="Aucune équipe pour l’instant"
            action={
              canManageTeams ? (
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => setShowCreate(true)}
                >
                  Créer la première équipe
                </Button>
              ) : undefined
            }
          >
            {canManageTeams
              ? "Créez une équipe pour y organiser joueurs et coachs."
              : "Aucune équipe ne vous est rattachée."}
          </EmptyState>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            action={
              filtersActive ? (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Effacer les filtres
                </Button>
              ) : undefined
            }
          >
            Aucune équipe ne correspond à ces filtres.
          </EmptyState>
        </Card>
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => {
            const isCollapsed = !searchActive && collapsed.has(group.category);
            const incompleteInGroup = group.entries.filter(
              (entry) => entry.issues.length > 0,
            ).length;
            const headingId = `teams-group-${group.category}`;
            return (
              <div
                key={group.category}
                className={styles.groupTone}
                data-tone={toneOf(group.category)}
              >
              <Card
                padding="none"
                className={styles.group}
                aria-labelledby={headingId}
              >
                <h2 className={styles.groupHeading} id={headingId}>
                  <button
                    type="button"
                    className={styles.groupToggle}
                    data-has-issues={
                      canManageTeams && incompleteInGroup > 0 ? "true" : undefined
                    }
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleGroup(group.category)}
                  >
                    <Icon
                      name="chevronDown"
                      size={18}
                      className={styles.groupChevron}
                    />
                    <span className={styles.toneDot} aria-hidden />
                    <span className={styles.groupName}>{group.category}</span>
                    <span className={styles.groupCount}>
                      {countLabel(group.entries.length, "équipe")}
                    </span>
                  </button>
                  {canManageTeams && incompleteInGroup > 0 ? (
                    <span className={styles.groupIssues}>
                      <StatusBadge
                        tone="warning"
                        dot
                        onClick={() => showIncompleteInCategory(group.category)}
                        actionLabel={`${incompleteInGroup} à compléter : afficher les équipes ${group.category} à compléter`}
                      >
                        {incompleteInGroup} à compléter
                      </StatusBadge>
                    </span>
                  ) : null}
                </h2>
                {isCollapsed ? null : (
                  <ListRows aria-label={`Équipes ${group.category}`}>
                    {group.entries.map(renderRow)}
                  </ListRows>
                )}
              </Card>
              </div>
            );
          })}
        </div>
      )}

      {selectedTeam ? (
        <TeamDetailPanel
          team={selectedTeam}
          tone={toneOf(selectedTeam.category)}
          membersById={membersById}
          busy={busy}
          error={error}
          viewerMemberId={viewerMemberId}
          canEdit={canManageTeams}
          canDelete={canManageTeams}
          canManageCoaches={canManageTeams}
          canAddPlayer={canAddPlayerToTeam(selectedTeam)}
          canRemovePlayer={canManageTeams}
          canToggleSparring={canAddPlayerToTeam(selectedTeam)}
          canShareInvite={canShareTeamInvite(selectedTeam)}
          onClose={() => {
            setSelectedTeamId(null);
            onClearError();
          }}
          onEdit={() => {
            onClearError();
            setEditingTeam(selectedTeam);
          }}
          onInvite={() => setInvitingTeam(selectedTeam)}
          onAddMember={(role) => {
            onClearError();
            setAddingRole(role);
          }}
          onRemoveMember={(memberId, role) =>
            onRemoveMember({ teamId: selectedTeam.id, memberId, role })
          }
          onSetSparring={(memberId, sparring) =>
            onSetSparring({ teamId: selectedTeam.id, memberId, sparring })
          }
          onDelete={async () => {
            const deleted = await onDeleteTeam(selectedTeam.id);
            if (deleted) setSelectedTeamId(null);
          }}
        />
      ) : null}

      {showCreate && canManageTeams ? (
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

      {addingRole && selectedTeam ? (
        <AddTeamMemberDialog
          role={addingRole}
          members={members}
          excludedIds={
            new Set(
              addingRole === "coach"
                ? selectedTeam.coachIds
                : selectedTeam.playerIds,
            )
          }
          busy={busy}
          error={error}
          onClose={() => setAddingRole(null)}
          onSubmit={async (memberId) => {
            await onAddMember({
              teamId: selectedTeam.id,
              memberId,
              role: addingRole,
            });
            setAddingRole(null);
          }}
        />
      ) : null}

      {invitingTeam ? (
        <InviteTeamDialog
          clubId={clubId}
          clubName={clubName}
          teamId={invitingTeam.id}
          teamName={invitingTeam.name}
          onClose={() => setInvitingTeam(null)}
        />
      ) : null}
    </div>
  );
}
