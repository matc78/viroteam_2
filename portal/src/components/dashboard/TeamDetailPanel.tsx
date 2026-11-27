"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
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
import { TeamFederationSection } from "./TeamFederationSection";
import styles from "./TeamDetailPanel.module.css";

/** Au-delà, un champ filtre la liste des joueurs du panneau. */
const PLAYER_FILTER_THRESHOLD = 12;

/** Type de donnée du glisser-déposer Joueurs ↔ Sparrings (id de fiche). */
const ROSTER_DRAG_TYPE = "application/x-viroteam-roster-member";

/** Section d’une ligne de roster. */
type RosterZone = "coach" | "player" | "sparring";

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
  /** Passer un joueur sparring / le repasser joueur. */
  canToggleSparring: boolean;
  canShareInvite: boolean;
  /** Section Calendrier FFVB (clubs de volley), `null` sinon. */
  federation: { clubId: string; canManage: boolean } | null;
  onClose: () => void;
  onEdit: () => void;
  onInvite: () => void;
  onAddMember: (role: TeamRosterRole) => void;
  onRemoveMember: (memberId: string, role: TeamRosterRole) => Promise<void>;
  onSetSparring: (memberId: string, sparring: boolean) => Promise<void>;
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
  canToggleSparring,
  canShareInvite,
  federation,
  onClose,
  onEdit,
  onInvite,
  onAddMember,
  onRemoveMember,
  onSetSparring,
  onDelete,
}: TeamDetailPanelProps) {
  const panelRef = useDialogA11y({ onClose, modal: false });
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(
    null,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [playerFilter, setPlayerFilter] = useState("");
  /** Section d’origine du joueur en cours de glisser-déposer. */
  const [dragFrom, setDragFrom] = useState<"player" | "sparring" | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** Section survolée pendant le glisser-déposer (cible de dépôt). */
  const [dropTarget, setDropTarget] = useState<"player" | "sparring" | null>(
    null,
  );

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
  const sparringIds = useMemo(() => new Set(team.sparringIds), [team.sparringIds]);
  const visiblePlayers = useMemo(() => {
    const needle = normalizeSearchText(playerFilter);
    if (!needle) return players;
    return players.filter((person) =>
      normalizeSearchText(person.displayName).includes(needle),
    );
  }, [players, playerFilter]);
  const regularPlayers = visiblePlayers.filter(
    (person) => !sparringIds.has(person.memberId),
  );
  const sparrings = visiblePlayers.filter((person) =>
    sparringIds.has(person.memberId),
  );
  const sparringCount = players.filter((person) =>
    sparringIds.has(person.memberId),
  ).length;
  const regularPlayerCount = players.length - sparringCount;
  const canDragPlayers = canToggleSparring && !busy;

  const categoryLabel = team.category.trim() || NO_CATEGORY_LABEL;

  /** Fin du glisser-déposer (dépôt, abandon ou sortie du panneau). */
  function endDrag() {
    setDragFrom(null);
    setDropTarget(null);
    setDraggingId(null);
  }

  /** Props de dépôt d’une section Joueurs / Sparrings. */
  function dropZoneProps(zone: "player" | "sparring") {
    const accepts = canDragPlayers && dragFrom !== null && dragFrom !== zone;
    return {
      "data-drop-active": accepts && dropTarget === zone ? "true" : undefined,
      "data-drop-ready": accepts ? "true" : undefined,
      onDragOver: (dragEvent: DragEvent) => {
        if (!accepts) return;
        dragEvent.preventDefault();
        dragEvent.dataTransfer.dropEffect = "move";
        if (dropTarget !== zone) setDropTarget(zone);
      },
      onDragLeave: (dragEvent: DragEvent) => {
        const next = dragEvent.relatedTarget as Node | null;
        if (next && dragEvent.currentTarget.contains(next)) return;
        if (dropTarget === zone) setDropTarget(null);
      },
      onDrop: (dragEvent: DragEvent) => {
        if (!accepts) return;
        dragEvent.preventDefault();
        const memberId = dragEvent.dataTransfer.getData(ROSTER_DRAG_TYPE);
        endDrag();
        if (memberId) void onSetSparring(memberId, zone === "sparring");
      },
    };
  }

  /** Ligne d’une personne du roster, avec retrait confirmé sur place. */
  function renderPerson(person: RosterPerson, zone: RosterZone) {
    const role: TeamRosterRole = zone === "coach" ? "coach" : "player";
    const canRemove = role === "coach" ? canManageCoaches : canRemovePlayer;
    const confirmKey = `${role}:${person.memberId}`;
    const confirming = confirmingRemoval === confirmKey;
    const isViewer = person.memberId === viewerMemberId;
    const draggable = zone !== "coach" && canDragPlayers && !confirming;
    return (
      <li
        key={confirmKey}
        className={styles.person}
        data-confirming={confirming ? "true" : undefined}
        data-draggable={draggable ? "true" : undefined}
        data-dragging={
          dragFrom === zone && draggingId === person.memberId ? "true" : undefined
        }
        draggable={draggable || undefined}
        onDragStart={
          draggable
            ? (dragEvent) => {
                dragEvent.dataTransfer.setData(ROSTER_DRAG_TYPE, person.memberId);
                dragEvent.dataTransfer.effectAllowed = "move";
                setDraggingId(person.memberId);
                setDragFrom(zone === "sparring" ? "sparring" : "player");
              }
            : undefined
        }
        onDragEnd={draggable ? endDrag : undefined}
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
        {confirming ? null : <RoleBadge role={zone} size="sm" />}
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
              <button
                type="button"
                className={styles.addButton}
                disabled={busy}
                onClick={() => onAddMember("coach")}
                aria-label="Ajouter un coach"
                title="Ajouter un coach"
              >
                <Icon name="plus" size={16} />
              </button>
            ) : null}
          </div>
          {coaches.length === 0 ? (
            <p className={styles.empty}>
              <StatusBadge
                tone="warning"
                dot
                onClick={
                  canManageCoaches && !busy
                    ? () => onAddMember("coach")
                    : undefined
                }
                actionLabel={
                  canManageCoaches ? "Sans coach : ajouter un coach" : undefined
                }
              >
                Sans coach
              </StatusBadge>
            </p>
          ) : (
            <ul className={styles.people}>
              {coaches.map((person) => renderPerson(person, "coach"))}
            </ul>
          )}
        </section>

        <section
          className={styles.section}
          aria-labelledby="team-players"
          {...dropZoneProps("player")}
        >
          <div className={styles.sectionHeader}>
            <h3 id="team-players" className={styles.sectionTitle}>
              Joueurs <span className={styles.sectionCount}>{regularPlayerCount}</span>
            </h3>
            {canAddPlayer ? (
              <button
                type="button"
                className={styles.addButton}
                disabled={busy}
                onClick={() => onAddMember("player")}
                aria-label="Ajouter un joueur"
                title="Ajouter un joueur"
              >
                <Icon name="plus" size={16} />
              </button>
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
              <StatusBadge
                tone="warning"
                dot
                onClick={
                  canAddPlayer && !busy
                    ? () => onAddMember("player")
                    : undefined
                }
                actionLabel={
                  canAddPlayer ? "Aucun joueur : ajouter un joueur" : undefined
                }
              >
                Aucun joueur
              </StatusBadge>
            </p>
          ) : visiblePlayers.length === 0 ? (
            <p className={styles.emptyText}>Aucun joueur ne correspond.</p>
          ) : regularPlayers.length === 0 ? (
            <p className={styles.emptyText}>
              {playerFilter
                ? "Aucun joueur ne correspond."
                : "Tous les joueurs sont sparrings."}
            </p>
          ) : (
            <ul className={styles.people}>
              {regularPlayers.map((person) => renderPerson(person, "player"))}
            </ul>
          )}
        </section>

        {players.length > 0 && (canToggleSparring || sparringCount > 0) ? (
          <section
            className={styles.section}
            aria-labelledby="team-sparrings"
            {...dropZoneProps("sparring")}
          >
            <div className={styles.sectionHeader}>
              <h3 id="team-sparrings" className={styles.sectionTitle}>
                Sparrings <span className={styles.sectionCount}>{sparringCount}</span>
              </h3>
            </div>
            <p className={styles.sectionHint}>
              S’entraînent avec l’équipe mais ne sont pas convoqués d’office aux
              matchs : à ajouter match par match dans « Gérer les convoqués ».
            </p>
            {sparrings.length > 0 ? (
              <ul className={styles.people}>
                {sparrings.map((person) => renderPerson(person, "sparring"))}
              </ul>
            ) : sparringCount > 0 ? (
              <p className={styles.emptyText}>Aucun sparring ne correspond.</p>
            ) : canToggleSparring ? (
              <p className={styles.dropHint}>
                Glissez un joueur ici pour en faire un sparring.
              </p>
            ) : null}
          </section>
        ) : null}

        {federation ? (
          <TeamFederationSection
            // Une section par équipe : aucun état (requête, message) ne passe
            // d’une équipe à l’autre.
            key={team.id}
            clubId={federation.clubId}
            team={team}
            membersById={membersById}
            canManage={federation.canManage}
          />
        ) : null}

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
