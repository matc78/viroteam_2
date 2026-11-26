"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { joinCopy } from "@/lib/copy/joinCopy";
import type { TeamOption } from "@/lib/firebase/eventService";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import type { TeamRosterRole } from "@/lib/firebase/teamService";
import type { TeamCategoryPaletteTone } from "@/lib/teams/teamCategoryTone";
import {
  NO_CATEGORY_LABEL,
  normalizeSearchText,
} from "@/lib/teams/teamsOverview";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import { MemberAvatar } from "./MemberAvatar";
import { RoleBadge } from "./RoleBadge";
import styles from "./TeamDetailPanel.module.css";

/** Au-delà, un champ filtre la liste des joueurs du panneau. */
const PLAYER_FILTER_THRESHOLD = 12;

/** Personne d’un roster affichée dans le panneau. */
type RosterPerson = {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  hasLinkedAccount: boolean;
};

/** Props du panneau détail équipe (bureau). */
type TeamDetailPanelProps = {
  team: TeamOption;
  /** Couleur de la catégorie (même attribution que la liste). */
  tone: TeamCategoryPaletteTone;
  membersById: ReadonlyMap<string, ClubMemberRecord>;
  busy: boolean;
  error: string | null;
  /** Fiche du viewer, remontée en tête et en gras. */
  viewerMemberId?: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canManageCoaches: boolean;
  canAddPlayer: boolean;
  canRemovePlayer: boolean;
  canShareInvite: boolean;
  onClose: () => void;
  onEdit: () => void;
  onInvite: () => void;
  onAddMember: (role: TeamRosterRole) => void;
  onRemoveMember: (memberId: string, role: TeamRosterRole) => Promise<void>;
  onDelete: () => Promise<void>;
};

/** Roster trié par nom, fiche du viewer en tête. */
function resolveRoster(
  ids: string[],
  membersById: ReadonlyMap<string, ClubMemberRecord>,
  viewerMemberId: string | null,
): RosterPerson[] {
  const people = [...new Set(ids)].map((memberId) => {
    const member = membersById.get(memberId);
    return {
      memberId,
      displayName: member?.displayName ?? "Membre inconnu",
      avatarUrl: member?.avatarUrl ?? null,
      hasLinkedAccount: member?.hasLinkedAccount ?? false,
    };
  });
  people.sort((a, b) => {
    if (a.memberId === viewerMemberId) return -1;
    if (b.memberId === viewerMemberId) return 1;
    return a.displayName.localeCompare(b.displayName, "fr");
  });
  return people;
}

/** Pluriel simple (« 1 joueur », « 3 joueurs »). */
function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count > 1 ? "s" : ""}`;
}

/**
 * Panneau latéral non modal d’une équipe : coachs, joueurs, code
 * d’invitation et suppression. La liste reste utilisable à côté.
 */
export function TeamDetailPanel({
  team,
  tone,
  membersById,
  busy,
  error,
  viewerMemberId = null,
  canEdit,
  canDelete,
  canManageCoaches,
  canAddPlayer,
  canRemovePlayer,
  canShareInvite,
  onClose,
  onEdit,
  onInvite,
  onAddMember,
  onRemoveMember,
  onDelete,
}: TeamDetailPanelProps) {
  const panelRef = useDialogA11y({ onClose, modal: false });
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(
    null,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [playerFilter, setPlayerFilter] = useState("");

  useEffect(() => {
    setConfirmingRemoval(null);
    setConfirmingDelete(false);
    setPlayerFilter("");
  }, [team.id]);

  const coaches = useMemo(
    () => resolveRoster(team.coachIds, membersById, viewerMemberId),
    [team.coachIds, membersById, viewerMemberId],
  );
  const players = useMemo(
    () => resolveRoster(team.playerIds, membersById, viewerMemberId),
    [team.playerIds, membersById, viewerMemberId],
  );
  const visiblePlayers = useMemo(() => {
    const needle = normalizeSearchText(playerFilter);
    if (!needle) return players;
    return players.filter((person) =>
      normalizeSearchText(person.displayName).includes(needle),
    );
  }, [players, playerFilter]);

  const categoryLabel = team.category.trim() || NO_CATEGORY_LABEL;

  /** Ligne d’une personne du roster, avec retrait confirmé sur place. */
  function renderPerson(person: RosterPerson, role: TeamRosterRole) {
    const canRemove = role === "coach" ? canManageCoaches : canRemovePlayer;
    const confirmKey = `${role}:${person.memberId}`;
    const confirming = confirmingRemoval === confirmKey;
    const isViewer = person.memberId === viewerMemberId;
    return (
      <li
        key={confirmKey}
        className={styles.person}
        data-confirming={confirming ? "true" : undefined}
      >
        <MemberAvatar
          displayName={person.displayName}
          avatarUrl={person.avatarUrl}
          hasLinkedAccount={person.hasLinkedAccount}
          size="xs"
          enableZoom={false}
        />
        <span
          className={styles.personName}
          data-viewer={isViewer ? "true" : undefined}
        >
          {person.displayName}
          {isViewer ? <span className={styles.youTag}>Moi</span> : null}
        </span>
        {confirming ? null : (
          <RoleBadge role={role === "coach" ? "coach" : "player"} size="sm" />
        )}
        {canRemove ? (
          confirming ? (
            <span className={styles.confirmInline}>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  await onRemoveMember(person.memberId, role);
                  setConfirmingRemoval(null);
                }}
              >
                Retirer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmingRemoval(null)}
              >
                Annuler
              </Button>
            </span>
          ) : (
            <button
              type="button"
              className={styles.iconButton}
              disabled={busy}
              aria-label={`Retirer ${person.displayName} de l’équipe`}
              title="Retirer de l’équipe"
              onClick={() => setConfirmingRemoval(confirmKey)}
            >
              <Icon name="close" size={16} />
            </button>
          )
        ) : null}
      </li>
    );
  }

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby="team-detail-title"
      data-tone={tone}
    >
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>
            <span className={styles.toneDot} aria-hidden />
            {categoryLabel}
          </p>
          <h2 id="team-detail-title" className={styles.title}>
            {team.name}
          </h2>
          <p className={styles.meta}>
            {countLabel(players.length, "joueur")} ·{" "}
            {countLabel(coaches.length, "coach")}
          </p>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onClose}
          aria-label="Fermer le détail de l’équipe"
          title="Fermer"
        >
          <Icon name="close" size={18} />
        </button>
      </header>

      {canEdit || canShareInvite ? (
        <div className={styles.headerActions}>
          {canEdit ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onEdit}>
              <Icon name="pencil" size={16} />
              Modifier
            </Button>
          ) : null}
          {canShareInvite ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onInvite}
            >
              <Icon name="share" size={16} />
              {joinCopy.inviteTeamTitle}
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.body}>
        <section className={styles.section} aria-labelledby="team-coaches">
          <div className={styles.sectionHeader}>
            <h3 id="team-coaches" className={styles.sectionTitle}>
              Coachs <span className={styles.sectionCount}>{coaches.length}</span>
            </h3>
            {canManageCoaches ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onAddMember("coach")}
              >
                <Icon name="plus" size={16} />
                Ajouter
              </Button>
            ) : null}
          </div>
          {coaches.length === 0 ? (
            <p className={styles.empty}>
              <StatusBadge tone="warning" dot>
                Sans coach
              </StatusBadge>
            </p>
          ) : (
            <ul className={styles.people}>
              {coaches.map((person) => renderPerson(person, "coach"))}
            </ul>
          )}
        </section>

        <section className={styles.section} aria-labelledby="team-players">
          <div className={styles.sectionHeader}>
            <h3 id="team-players" className={styles.sectionTitle}>
              Joueurs <span className={styles.sectionCount}>{players.length}</span>
            </h3>
            {canAddPlayer ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onAddMember("player")}
              >
                <Icon name="plus" size={16} />
                Ajouter
              </Button>
            ) : null}
          </div>
          {players.length > PLAYER_FILTER_THRESHOLD ? (
            <label className={styles.filterField}>
              <Icon name="search" size={16} className={styles.filterIcon} />
              <input
                className={styles.filterInput}
                type="search"
                value={playerFilter}
                placeholder="Filtrer les joueurs…"
                aria-label="Filtrer les joueurs de l’équipe"
                onChange={(event) => setPlayerFilter(event.target.value)}
              />
            </label>
          ) : null}
          {players.length === 0 ? (
            <p className={styles.empty}>
              <StatusBadge tone="warning" dot>
                Aucun joueur
              </StatusBadge>
            </p>
          ) : visiblePlayers.length === 0 ? (
            <p className={styles.emptyText}>Aucun joueur ne correspond.</p>
          ) : (
            <ul className={styles.people}>
              {visiblePlayers.map((person) => renderPerson(person, "player"))}
            </ul>
          )}
        </section>

        {canDelete ? (
          <section className={styles.dangerZone} aria-labelledby="team-danger">
            <h3 id="team-danger" className={styles.sectionTitle}>
              Zone sensible
            </h3>
            {confirmingDelete ? (
              <>
                <p className={styles.dangerText}>
                  Supprimer l’équipe « {team.name} » ? Les membres restent
                  dans le club.
                </p>
                <div className={styles.dangerActions}>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => void onDelete()}
                  >
                    Supprimer définitivement
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </>
            ) : (
              <div className={styles.dangerActions}>
                <Button
                  size="sm"
                  variant="ghost"
                  className={styles.dangerTrigger}
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Icon name="trash" size={16} />
                  Supprimer l’équipe
                </Button>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
