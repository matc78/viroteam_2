"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TeamOption } from "@/lib/firebase/eventService";
import { MemberRoles } from "@/lib/firebase/constants";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import type { TeamRosterRole } from "@/lib/firebase/teamService";
import {
  isTeamCardExpanded,
  setTeamCardExpanded,
} from "@/lib/teams/teamCardExpandedStorage";
import { teamCategoryTone } from "@/lib/teams/teamCategoryTone";
import styles from "./TeamsPanel.module.css";

type RosterPerson = {
  memberId: string;
  displayName: string;
  accountUid: string | null;
};

type TeamCardProps = {
  clubId: string;
  team: TeamOption;
  members: ClubMemberRecord[];
  busy: boolean;
  /** Texte de recherche à surligner dans les noms (joueurs / coachs). */
  searchQuery?: string;
  onEdit: () => void;
  onDelete: () => void;
  onAddMember: (role: TeamRosterRole) => void;
  onRemoveMember: (member: RosterPerson, role: TeamRosterRole) => void;
};

/**
 * Découpe un libellé pour surligner les occurrences de `query` (insensible à la casse).
 */
function highlightSearchMatches(
  text: string,
  query: string,
): { key: string; value: string; matched: boolean }[] {
  const needle = query.trim();
  if (!needle) return [{ key: "0", value: text, matched: false }];

  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: { key: string; value: string; matched: boolean }[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerNeedle);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      parts.push({
        key: `${cursor}-plain`,
        value: text.slice(cursor, matchIndex),
        matched: false,
      });
    }
    parts.push({
      key: `${matchIndex}-match`,
      value: text.slice(matchIndex, matchIndex + needle.length),
      matched: true,
    });
    cursor = matchIndex + needle.length;
    matchIndex = lowerText.indexOf(lowerNeedle, cursor);
  }

  if (cursor < text.length) {
    parts.push({
      key: `${cursor}-tail`,
      value: text.slice(cursor),
      matched: false,
    });
  }

  return parts.length > 0 ? parts : [{ key: "0", value: text, matched: false }];
}

/** Affiche un texte avec surlignage des correspondances de recherche. */
function SearchHighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const parts = highlightSearchMatches(text, query);
  return (
    <>
      {parts.map((part) =>
        part.matched ? (
          <mark key={part.key} className={styles.searchHighlight}>
            {part.value}
          </mark>
        ) : (
          <span key={part.key}>{part.value}</span>
        ),
      )}
    </>
  );
}

function resolveRosterPeople(
  rosterIds: string[],
  members: ClubMemberRecord[],
): RosterPerson[] {
  const people: RosterPerson[] = [];
  const seen = new Set<string>();

  for (const rosterId of rosterIds) {
    const member = members.find(
      (row) =>
        row.memberId === rosterId ||
        (row.accountUid != null && row.accountUid === rosterId),
    );
    if (!member) {
      if (!seen.has(rosterId)) {
        seen.add(rosterId);
        people.push({
          memberId: rosterId,
          displayName: "Membre inconnu",
          accountUid: null,
        });
      }
      continue;
    }
    if (seen.has(member.memberId)) continue;
    seen.add(member.memberId);
    people.push({
      memberId: member.memberId,
      displayName: member.displayName,
      accountUid: member.accountUid,
    });
  }

  return people.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "fr"),
  );
}

/** Carte équipe expandable : coachs et joueurs en chips, actions discrètes. */
export function TeamCard({
  clubId,
  team,
  members,
  busy,
  searchQuery = "",
  onEdit,
  onDelete,
  onAddMember,
  onRemoveMember,
}: TeamCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpanded(isTeamCardExpanded(clubId, team.id));
  }, [clubId, team.id]);

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      setTeamCardExpanded(clubId, team.id, next);
      return next;
    });
  }

  const players = useMemo(
    () => resolveRosterPeople(team.playerIds, members),
    [team.playerIds, members],
  );
  const coaches = useMemo(
    () => resolveRosterPeople(team.coachIds, members),
    [team.coachIds, members],
  );

  const categoryLabel = team.category.trim() || "Sans catégorie";
  const playerCountLabel = `${players.length} joueur${players.length === 1 ? "" : "s"}`;
  const categoryTone = teamCategoryTone(categoryLabel);
  const searchActive = searchQuery.trim().length > 0;
  const showPlayers = searchActive || expanded;

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <article className={styles.card} data-tone={categoryTone}>
      <div className={styles.cardTop}>
        <button
          type="button"
          className={styles.cardHeader}
          aria-expanded={showPlayers}
          onClick={toggleExpanded}
        >
          <div className={styles.cardTitleBlock}>
            <h3 className={styles.cardTitle}>
              <SearchHighlightedText text={team.name} query={searchQuery} />
            </h3>
            <p className={styles.cardMeta}>
              <SearchHighlightedText text={categoryLabel} query={searchQuery} />
            </p>
          </div>
          <span className={styles.playerCount}>{playerCountLabel}</span>
          <span
            className={`${styles.cardChevron} ${showPlayers ? styles.cardChevronOpen : ""}`}
            aria-hidden
          >
            ›
          </span>
        </button>

        <div className={styles.cardMenu} ref={menuRef}>
          <button
            type="button"
            className={styles.menuTrigger}
            aria-label={`Actions pour ${team.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((current) => !current);
            }}
          >
            ⋮
          </button>
          {menuOpen ? (
            <div className={styles.menuDropdown} role="menu">
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                disabled={busy}
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              >
                Modifier
              </button>
              <button
                type="button"
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                role="menuitem"
                disabled={busy}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                Supprimer l’équipe
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.coachBlock}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Coachs</h4>
          <button
            type="button"
            className={styles.fabMini}
            disabled={busy}
            aria-label="Ajouter un coach"
            title="Ajouter un coach"
            onClick={() => onAddMember(MemberRoles.coach)}
          >
            +
          </button>
        </div>
        {coaches.length === 0 ? (
          <p className={styles.rosterEmpty}>Aucun coach</p>
        ) : (
          <ul className={styles.chipList}>
            {coaches.map((person) => (
              <li key={`coach-${person.memberId}`} className={styles.chip}>
                <span className={styles.chipLabel}>
                  <SearchHighlightedText
                    text={person.displayName}
                    query={searchQuery}
                  />
                </span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  disabled={busy}
                  aria-label={`Retirer ${person.displayName}`}
                  title="Retirer"
                  onClick={() => onRemoveMember(person, MemberRoles.coach)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showPlayers ? (
        <div className={styles.cardBody}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Joueurs</h4>
              <button
                type="button"
                className={styles.fabMini}
                disabled={busy}
                aria-label="Ajouter un joueur"
                title="Ajouter un joueur"
                onClick={() => onAddMember(MemberRoles.player)}
              >
                +
              </button>
            </div>
            {players.length === 0 ? (
              <p className={styles.rosterEmpty}>Aucun joueur</p>
            ) : (
              <ul className={styles.chipList}>
                {players.map((person) => (
                  <li key={`player-${person.memberId}`} className={styles.chip}>
                    <span className={styles.chipLabel}>
                      <SearchHighlightedText
                        text={person.displayName}
                        query={searchQuery}
                      />
                    </span>
                    <button
                      type="button"
                      className={styles.chipRemove}
                      disabled={busy}
                      aria-label={`Retirer ${person.displayName}`}
                      title="Retirer"
                      onClick={() =>
                        onRemoveMember(person, MemberRoles.player)
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </article>
  );
}
